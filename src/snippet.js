/**
 * The JS snippet injected into dsh-pet's desktop renderer.
 *
 * It only uses the Web Audio API (no asset files), fails silently when audio is
 * unavailable, and keeps a single AudioContext alive between clicks.
 */

export const MARKER_BEGIN = '/* dsh-pet-sound:begin */';
export const MARKER_END = '/* dsh-pet-sound:end */';

/**
 * Build the injected block.
 *
 * @param {{volume?: number}} [options]
 * @returns {string} a self-contained JS block, terminated by a newline
 */
export function buildSnippet(options = {}) {
  const volume = Number.isFinite(options.volume) ? options.volume : 0.16;
  const safeVolume = Math.min(Math.max(volume, 0.01), 1);

  return [
    MARKER_BEGIN,
    '// Click sound for the DSH desktop pet, injected by dsh-pet-sound.',
    '// Remove this block (or run `dsh-pet-sound revert`) to restore the original behaviour.',
    'let __dshPetSoundCtx = null;',
    'function __dshPetSound() {',
    '  try {',
    '    const AC = window.AudioContext || window.webkitAudioContext;',
    '    if (!AC) return;',
    '    if (!__dshPetSoundCtx) __dshPetSoundCtx = new AC();',
    '    const ctx = __dshPetSoundCtx;',
    "    if (ctx.state === 'suspended') ctx.resume();",
    '    const t0 = ctx.currentTime;',
    '    const osc = ctx.createOscillator();',
    '    const gain = ctx.createGain();',
    "    osc.type = 'sine';",
    '    osc.frequency.setValueAtTime(880, t0);',
    '    osc.frequency.exponentialRampToValueAtTime(1318.5, t0 + 0.055);',
    `    gain.gain.setValueAtTime(${safeVolume}, t0);`,
    '    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.17);',
    '    osc.connect(gain);',
    '    gain.connect(ctx.destination);',
    '    osc.start(t0);',
    '    osc.stop(t0 + 0.19);',
    '  } catch (_error) {',
    '    /* audio unavailable: stay silent instead of breaking the pet */',
    '  }',
    '}',
    MARKER_END,
    ''
  ].join('\n');
}
