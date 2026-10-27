/**
 * Locate dsh-pet installations inside DeepSeek Harness profiles.
 *
 * We never guess a single hard-coded path: the caller may pass an explicit
 * profile directory, or we scan `$DSH_HOME/profiles/<name>` (DSH_HOME defaults
 * to `~/.dsh`). Every candidate is verified to contain the renderer file.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Relative path of the renderer inside the dsh-pet package. */
export const SPRITE_REL = join('node_modules', 'dsh-pet', 'runtime', 'electron-helper', 'sprite.js');

/** @returns {string} `$DSH_HOME` or `~/.dsh` */
export function dshHome() {
  const fromEnv = process.env.DSH_HOME;
  return fromEnv && fromEnv.trim() ? fromEnv.trim() : join(homedir(), '.dsh');
}

/**
 * @param {string} profileDir
 * @returns {{profile: string, sprite: string, petVersion: string|null}|null}
 */
export function inspectProfile(profileDir) {
  const sprite = join(profileDir, SPRITE_REL);
  if (!existsSync(sprite)) return null;

  let petVersion = null;
  try {
    const pkg = JSON.parse(readFileSync(join(profileDir, 'node_modules', 'dsh-pet', 'package.json'), 'utf8'));
    petVersion = typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    /* package.json missing or unreadable: version stays unknown */
  }

  return { profile: profileDir, sprite, petVersion };
}

/**
 * @param {{profile?: string}} [options]
 * @returns {Array<{profile: string, sprite: string, petVersion: string|null}>}
 */
export function findInstallations(options = {}) {
  if (options.profile) {
    const hit = inspectProfile(options.profile);
    if (!hit) {
      throw new Error(
        `dsh-pet not found under ${options.profile} (expected ${SPRITE_REL}). ` +
          'Pass the profile directory that contains node_modules/dsh-pet.'
      );
    }
    return [hit];
  }

  const profilesDir = join(dshHome(), 'profiles');
  if (!existsSync(profilesDir)) return [];

  const found = [];
  for (const name of readdirSync(profilesDir)) {
    const hit = inspectProfile(join(profilesDir, name));
    if (hit) found.push(hit);
  }
  return found;
}
