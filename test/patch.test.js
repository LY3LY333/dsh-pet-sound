import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyPatch, isPatched, revertPatch, inspect } from '../src/patch.js';
import { buildSnippet, MARKER_BEGIN, MARKER_END } from '../src/snippet.js';

/** A miniature stand-in for dsh-pet's renderer: just enough shape to patch. */
const FIXTURE = `/**
 * fake renderer for tests
 */
'use strict';

// some unrelated code
const OPEN_SHORTCUT_HINT = 'Ctrl';

class PetSprite {
  constructor(pet) {
    this.pet = pet;
  }

  onPointerDown(e) {
    this.pressed = true;
  }

  onClick(e) {
    const d = this.dragState;
    if (d.active) return;
    this.playOnce('click');
  }
}

export { PetSprite };
`;

test('applyPatch injects the helper block and the click call', () => {
  const { changed, source } = applyPatch(FIXTURE);
  assert.equal(changed, true);
  assert.ok(source.includes(MARKER_BEGIN));
  assert.ok(source.includes(MARKER_END));
  assert.ok(source.includes('__dshPetSound(); // dsh-pet-sound'));
  assert.ok(isPatched(source));
});

test('applyPatch keeps the original code intact', () => {
  const { source } = applyPatch(FIXTURE);
  assert.ok(source.includes("const OPEN_SHORTCUT_HINT = 'Ctrl';"));
  assert.ok(source.includes("this.playOnce('click');"));
  // click handler still runs its own body
  assert.match(source, /onClick\(e\)\s*\{\n\s+__dshPetSound\(\); \/\/ dsh-pet-sound\n\s+const d = this\.dragState;/);
});

test('applyPatch is idempotent', () => {
  const once = applyPatch(FIXTURE).source;
  const twice = applyPatch(once);
  assert.equal(twice.changed, false);
  assert.equal(twice.reason, 'already-patched');
  assert.equal(twice.source, once);
  // only one call site
  assert.equal(once.split('__dshPetSound();').length - 1, 1);
});

test('revertPatch restores the original source byte for byte', () => {
  const patched = applyPatch(FIXTURE).source;
  const reverted = revertPatch(patched);
  assert.equal(reverted.changed, true);
  assert.equal(reverted.source, FIXTURE);
  assert.equal(isPatched(reverted.source), false);
});

test('revertPatch is idempotent', () => {
  const first = revertPatch(FIXTURE);
  assert.equal(first.changed, false);
  assert.equal(first.reason, 'not-patched');
  assert.equal(first.source, FIXTURE);
});

test('applyPatch reports a missing anchor instead of corrupting the file', () => {
  const noHandler = FIXTURE.replace('  onClick(e) {', '  onClickHandler(e) {');
  const result = applyPatch(noHandler);
  assert.equal(result.changed, false);
  assert.equal(result.reason, 'anchor-not-found');
  assert.equal(result.source, noHandler);
});

test('buildSnippet clamps the volume and stays self contained', () => {
  const loud = buildSnippet({ volume: 5 });
  assert.ok(loud.includes('setValueAtTime(1, t0)'));
  const quiet = buildSnippet({ volume: -1 });
  assert.ok(quiet.includes('setValueAtTime(0.01, t0)'));
  assert.ok(loud.startsWith(MARKER_BEGIN));
  assert.ok(loud.trimEnd().endsWith(MARKER_END));
  // no external assets, no imports
  assert.ok(!/\bimport\b/.test(loud));
  assert.ok(!/https?:\/\//.test(loud));
});

test('inspect summarizes a source file', () => {
  const clean = inspect(FIXTURE);
  assert.deepEqual(clean.patched, false);
  assert.equal(clean.hasAnchor, true);
  assert.ok(clean.bytes > 100);

  const patched = inspect(applyPatch(FIXTURE).source);
  assert.equal(patched.patched, true);
});

test('works with CRLF line endings', () => {
  const crlf = FIXTURE.replace(/\n/g, '\r\n');
  const { changed, source } = applyPatch(crlf);
  assert.equal(changed, true);
  const back = revertPatch(source);
  assert.equal(back.source.replace(/\r\n/g, '\n').includes('__dshPetSound'), false);
});

test('refuses to stack on top of a foreign click-sound hook', () => {
  const foreign = FIXTURE.replace(
    '  onClick(e) {',
    '  onClick(e) {\n    playPetClickSound();'
  ).replace("'use strict';", "'use strict';\nfunction playPetClickSound() {}");

  const refused = applyPatch(foreign);
  assert.equal(refused.changed, false);
  assert.equal(refused.reason, 'foreign-patch:manual-sound-hook');
  assert.equal(refused.source, foreign);

  const forced = applyPatch(foreign, { force: true });
  assert.equal(forced.changed, true);
  assert.ok(isPatched(forced.source));
});

