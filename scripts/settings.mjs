// The person's settings (resources/settings.json, untracked) over the tracked defaults
// (resources/settings.example.json): the one place the display language is read from. Law never reads
// it — a settings value changes what is printed to the person, never what is validated.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const SETTINGS_EXAMPLE = path.join('resources', 'settings.example.json');
export const SETTINGS_FILE = path.join('resources', 'settings.json');
// A language tag: two or three lowercase letters, optionally a region (vi, en, en-US).
export const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;

export function loadSettings(root) {
  const read = (rel) => { const f = path.join(root, rel); if (!existsSync(f)) return null; try { return JSON.parse(readFileSync(f, 'utf8')); } catch (e) { throw new Error(`${rel}: ${e.message}`); } };
  const example = read(SETTINGS_EXAMPLE) ?? {};
  const own = read(SETTINGS_FILE) ?? {};
  const { note: _n, schemaVersion: _s, ...defaults } = example;
  const { note: _n2, schemaVersion: _s2, ...overrides } = own;
  return { ...defaults, ...overrides, sources: { example: SETTINGS_EXAMPLE, own: existsSync(path.join(root, SETTINGS_FILE)) ? SETTINGS_FILE : null } };
}
export function settingsErrors(root) {
  const errors = [];
  let s; try { s = loadSettings(root); } catch (e) { return [e.message]; }
  if (typeof s.language !== 'string' || !LANGUAGE_TAG.test(s.language)) errors.push(`${s.sources.own ?? SETTINGS_EXAMPLE}: language must be a tag like vi or en-US, not ${JSON.stringify(s.language)}`);
  return errors;
}
export const displayLanguage = (root) => loadSettings(root).language ?? 'vi';
