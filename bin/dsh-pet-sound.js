#!/usr/bin/env node
/**
 * dsh-pet-sound — add a soft click sound to the DSH desktop pet.
 *
 * Commands:
 *   status               show detected installations and patch state
 *   apply [--volume n]   inject the sound (idempotent, keeps a .bak)
 *   revert               remove the injected code (idempotent)
 *
 * Flags:
 *   --profile <dir>      explicit profile directory (default: scan $DSH_HOME/profiles)
 *   --dry-run            show what would change without writing
 *   --json               machine readable output
 */

import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { applyPatch, inspect, isPatched, revertPatch } from '../src/patch.js';
import { findInstallations } from '../src/paths.js';

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith('-')) ?? 'status';
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback = undefined) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const json = flag('json');
const dryRun = flag('dry-run');
const profile = value('profile');
const volumeRaw = value('volume');
const volume = volumeRaw === undefined ? undefined : Number(volumeRaw);

function fail(message, code = 1) {
  if (json) console.log(JSON.stringify({ ok: false, error: message }));
  else console.error(`✖ ${message}`);
  process.exit(code);
}

function parseVolume() {
  if (volume === undefined) return undefined;
  if (!Number.isFinite(volume) || volume <= 0 || volume > 1) {
    fail(`--volume must be a number in (0, 1], got ${volumeRaw}`);
  }
  return volume;
}

function loadInstallations() {
  let found;
  try {
    found = findInstallations(profile ? { profile } : {});
  } catch (error) {
    fail(error.message);
  }
  if (found.length === 0) {
    fail(`no dsh-pet found under ${profile ?? 'any DSH profile (is DSH installed?)'}`);
  }
  return found;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function printRows(rows) {
  const pad = (s, n) => String(s).padEnd(n);
  console.log([pad('PROFILE', 18), pad('PET', 8), pad('STATE', 10), 'FILE'].join('  '));
  for (const r of rows) {
    console.log([pad(r.profileName, 18), pad(r.petVersion ?? '-', 8), pad(r.state, 10), r.sprite].join('  '));
  }
}

function runStatus() {
  const rows = loadInstallations().map((hit) => {
    const source = readFileSync(hit.sprite, 'utf8');
    return {
      profileName: hit.profile.split(/[\\/]/).filter(Boolean).pop(),
      petVersion: hit.petVersion,
      state: isPatched(source) ? 'patched' : 'clean',
      sprite: hit.sprite
    };
  });
  if (json) console.log(JSON.stringify({ ok: true, installations: rows }, null, 2));
  else printRows(rows);
}

function runApply() {
  const vol = parseVolume();
  const force = flag('force');
  const results = [];
  for (const hit of loadInstallations()) {
    const source = readFileSync(hit.sprite, 'utf8');
    const result = applyPatch(source, { ...(vol === undefined ? {} : { volume: vol }), force });
    const row = {
      profile: hit.profile,
      petVersion: hit.petVersion,
      changed: result.changed,
      reason: result.reason ?? null,
      backup: null
    };

    if (result.changed && !dryRun) {
      const backup = `${hit.sprite}.dsh-pet-sound.${timestamp()}.bak`;
      copyFileSync(hit.sprite, backup);
      writeFileSync(hit.sprite, result.source, 'utf8');
      row.backup = backup;
    }
    results.push(row);
  }

  if (json) {
    console.log(JSON.stringify({ ok: true, dryRun, results }, null, 2));
    return;
  }
  for (const r of results) {
    const where = r.profile.split(/[\\/]/).filter(Boolean).pop();
    if (!r.changed) {
      if (r.reason?.startsWith('foreign-patch:')) {
        console.log(`✖ ${where}: another click-sound hook is already present (${r.reason.split(':')[1]})`);
        console.log('  play two sounds? remove that hook first, or re-run with --force to stack it deliberately');
      } else {
        console.log(`• ${where}: nothing to do (${r.reason})`);
      }
    } else if (dryRun) {
      console.log(`• ${where}: would patch (dry run, nothing written)`);
    } else {
      console.log(`✓ ${where}: patched — restart dsh-pet to hear it`);
      console.log(`  backup: ${r.backup}`);
    }
  }
}

function runRevert() {
  const results = [];
  for (const hit of loadInstallations()) {
    const source = readFileSync(hit.sprite, 'utf8');
    const result = revertPatch(source);
    const row = {
      profile: hit.profile,
      petVersion: hit.petVersion,
      changed: result.changed,
      reason: result.reason ?? null,
      backup: null
    };
    if (result.changed && !dryRun) {
      const backup = `${hit.sprite}.dsh-pet-sound.${timestamp()}.bak`;
      copyFileSync(hit.sprite, backup);
      writeFileSync(hit.sprite, result.source, 'utf8');
      row.backup = backup;
    }
    results.push(row);
  }

  if (json) {
    console.log(JSON.stringify({ ok: true, dryRun, results }, null, 2));
    return;
  }
  for (const r of results) {
    const where = r.profile.split(/[\\/]/).filter(Boolean).pop();
    if (!r.changed) console.log(`• ${where}: nothing to do (${r.reason})`);
    else if (dryRun) console.log(`• ${where}: would revert (dry run)`);
    else console.log(`✓ ${where}: reverted — restart dsh-pet to apply`);
  }
}

switch (command) {
  case 'status':
    runStatus();
    break;
  case 'apply':
    runApply();
    break;
  case 'revert':
    runRevert();
    break;
  case 'help':
  case '--help':
  case '-h':
    console.log(
      [
        'dsh-pet-sound — add a click sound to the DSH desktop pet',
        '',
        'Usage:',
        '  dsh-pet-sound status [--json] [--profile <dir>]',
        '  dsh-pet-sound apply  [--volume 0.16] [--dry-run] [--json] [--profile <dir>]',
        '  dsh-pet-sound revert [--dry-run] [--json] [--profile <dir>]'
      ].join('\n')
    );
    break;
  default:
    fail(`unknown command "${command}" (try: status | apply | revert)`);
}

// exported for tests
export { inspect };
