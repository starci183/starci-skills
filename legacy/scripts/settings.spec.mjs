// The person's settings: scripts/settings.mjs reads resources/settings.json over settings.example.json.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadSettings, settingsErrors, displayLanguage } from './settings.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tree = (files) => { const dir = mkdtempSync(path.join(tmpdir(), 'settings-')); mkdirSync(path.join(dir, 'resources')); for (const [f, v] of Object.entries(files)) writeFileSync(path.join(dir, f), JSON.stringify(v)); return dir; };

test('the tracked example declares vi, the tree validates, and no own settings file is tracked', () => {
  assert.equal(loadSettings(root).language, 'vi');
  assert.deepEqual(settingsErrors(root), []);
});
test('an own settings.json overrides the example value by value, and the example fills what it leaves out', () => {
  const dir = tree({ 'resources/settings.example.json': { schemaVersion: 9, language: 'vi' }, 'resources/settings.json': { language: 'en' } });
  try { assert.equal(displayLanguage(dir), 'en'); assert.equal(loadSettings(dir).sources.own, path.join('resources', 'settings.json')); } finally { rmSync(dir, { recursive: true, force: true }); }
  const only = tree({ 'resources/settings.example.json': { schemaVersion: 9, language: 'vi' } });
  try { assert.equal(displayLanguage(only), 'vi'); assert.equal(loadSettings(only).sources.own, null); } finally { rmSync(only, { recursive: true, force: true }); }
});
test('a language that is not a tag is refused by name', () => {
  const dir = tree({ 'resources/settings.example.json': { schemaVersion: 9, language: 'vi' }, 'resources/settings.json': { language: 'Vietnamese' } });
  try { assert.ok(settingsErrors(dir).some((e) => e.includes('language must be a tag'))); } finally { rmSync(dir, { recursive: true, force: true }); }
});
