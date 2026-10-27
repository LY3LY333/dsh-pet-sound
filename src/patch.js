/**
 * Pure patching helpers for dsh-pet's renderer (sprite.js).
 *
 * Everything here is a string -> string transformation so it can be unit tested
 * without touching a real installation.
 */

import { MARKER_BEGIN, MARKER_END, buildSnippet } from './snippet.js';

/** The call we inject into `onClick(e) { ... }`. The trailing comment makes revert precise. */
export const CALL_LINE = '    __dshPetSound(); // dsh-pet-sound';

/** Anchor that identifies the click handler we patch. */
const CLICK_ANCHOR = /onClick\(e\)\s*\{\r?\n/;

/**
 * @param {string} source full sprite.js contents
 * @returns {boolean}
 */
export function isPatched(source) {
  return source.includes(MARKER_BEGIN) && source.includes(CALL_LINE);
}

/**
 * Detect a click-sound patch that this tool did not write (for example a
 * hand-edited hook). Applying on top would play two sounds, so `apply` refuses
 * unless the caller passes `force`.
 *
 * @param {string} source
 * @returns {string|null} a short label, or null when the file looks untouched
 */
export function detectForeignPatch(source) {
  if (isPatched(source)) return null;
  if (/playPetClickSound/.test(source)) return 'manual-sound-hook';
  if (/__dshPetSound\(\)/.test(source)) return 'stray-dsh-pet-sound-call';
  return null;
}

/**
 * Insert the helper + the click-handler call.
 *
 * @param {string} source
 * @param {{volume?: number, force?: boolean}} [options]
 * @returns {{changed: boolean, source: string, reason?: string}}
 */
export function applyPatch(source, options = {}) {
  if (typeof source !== 'string') throw new TypeError('source must be a string');
  if (isPatched(source)) return { changed: false, source, reason: 'already-patched' };

  const foreign = detectForeignPatch(source);
  if (foreign && !options.force) {
    return { changed: false, source, reason: `foreign-patch:${foreign}` };
  }

  if (!CLICK_ANCHOR.test(source)) {
    return { changed: false, source, reason: 'anchor-not-found' };
  }

  const snippet = buildSnippet(options);
  let next = source;

  // 1) helper block: right after the 'use strict' prologue when present,
  //    otherwise at the very top of the file.
  const strictMatch = next.match(/^(['"])use strict\1;[^\n]*\n/m);
  if (strictMatch) {
    const at = strictMatch.index + strictMatch[0].length;
    next = next.slice(0, at) + '\n' + snippet + next.slice(at);
  } else {
    next = snippet + next;
  }

  // 2) call inside onClick
  next = next.replace(CLICK_ANCHOR, (m) => m + CALL_LINE + '\n');

  return { changed: true, source: next };
}

/**
 * Remove the helper block and the injected call.
 *
 * @param {string} source
 * @returns {{changed: boolean, source: string, reason?: string}}
 */
export function revertPatch(source) {
  if (typeof source !== 'string') throw new TypeError('source must be a string');
  if (!isPatched(source) && !source.includes(MARKER_BEGIN)) {
    return { changed: false, source, reason: 'not-patched' };
  }

  let next = source;
  const begin = next.indexOf(MARKER_BEGIN);
  const end = next.indexOf(MARKER_END, begin);
  if (begin !== -1 && end !== -1) {
    let cutTo = end + MARKER_END.length;
    if (next[cutTo] === '\n') cutTo += 1;
    // swallow the blank line that applyPatch inserted before the block
    let cutFrom = begin;
    if (next[cutFrom - 1] === '\n' && next[cutFrom - 2] === '\n') cutFrom -= 1;
    next = next.slice(0, cutFrom) + next.slice(cutTo);
  }

  next = next
    .split('\n')
    .filter((line) => line !== CALL_LINE)
    .join('\n');

  return { changed: next !== source, source: next };
}

/**
 * Collect a few facts about a sprite.js source for `status` output.
 *
 * @param {string} source
 */
export function inspect(source) {
  return {
    patched: isPatched(source),
    hasAnchor: CLICK_ANCHOR.test(source),
    bytes: Buffer.byteLength(source, 'utf8')
  };
}
