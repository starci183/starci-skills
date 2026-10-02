import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { defaultOnceFindings, documentedLeaves, commentedLeaves, ownerDefaults, checkDefaultOnce, CODE } from '../../scripts/checks/check-default-once.mjs';

const paths = (findings) => findings.map((f) => [f.code, f.path]);
const leaves = (entries) => new Map(Object.entries(entries).map(([k, v]) => [k, new Set(v)]));

test('a camelCase documented leaf restated with any literal is RT_CONFIG_DEFAULT_TWICE', () => {
  const findings = defaultOnceFindings({
    'scripts/a/run.mjs': `const ms = cfg.pollIntervalMs ?? 600_000;\nconst fr = cfg?.frozenMinutes || 30;`,
    'scripts/b/run.mjs': `windowHours = 24;\n`,
  }, { leaves: leaves({ pollIntervalMs: ['600000'], frozenMinutes: [], windowHours: [] }) });
  assert.deepEqual(paths(findings), [
    ['RT_CONFIG_DEFAULT_TWICE', 'scripts/a/run.mjs'],
    ['RT_CONFIG_DEFAULT_TWICE', 'scripts/a/run.mjs'],
    ['RT_CONFIG_DEFAULT_TWICE', 'scripts/b/run.mjs'],
  ]);
});

test('a lowercase documented leaf trips only on a documented or owner-declared literal', () => {
  const findings = defaultOnceFindings({
    'scripts/a/run.mjs': `const m = conf.mode ?? 'chat';\nconst other = conf.mode ?? 'shadow';`,
  }, { leaves: leaves({ mode: ['chat', 'off'] }), ownerValues: leaves({ mode: ['shared'] }) });
  assert.deepEqual(paths(findings), [['RT_CONFIG_DEFAULT_TWICE', 'scripts/a/run.mjs']]);
  // 'shadow' is not a documented/owner value for mode, so it is a local default, not a restatement.
  assert.equal(findings.length, 1);
});

test('a language literal anywhere in a fallback chain is restated; the ternary re-derivation too', () => {
  const findings = defaultOnceFindings({
    'scripts/a/run.mjs': [
      `f({ language = 'vi' }) {}`,
      `const l = cfg.language ?? 'en';`,
      `const o = packet.owner_language ?? 'en';`,
      `const t = language === 'en' ? 'en' : 'vi';`,
      `label: 'language=' + (x === 'en' ? 'en' : 'vi'),`,
    ].join('\n'),
  }, { leaves: leaves({}), ownerLanguage: 'en' });
  assert.equal(findings.length, 5);
  assert.ok(findings.every((f) => f.code === CODE));
});

test('reading the owner constant or accessor is the compliant form', () => {
  const findings = defaultOnceFindings({
    'scripts/a/run.mjs': [
      `f({ language = ownerLanguage() }) {}`,
      `const l = cfg.language ?? ownerLanguage();`,
      `const m = conf.mode ?? configuredMode(n, conf);`,
      `const ms = cfg.pollIntervalMs ?? DEFAULTS.pollIntervalMs;`,
      `const e = payload.effort ?? rtDoc?.allocation?.redesign?.effort ?? null;`,
    ].join('\n'),
  }, { leaves: leaves({ mode: ['chat'], effort: ['high'], pollIntervalMs: ['600000'] }), ownerLanguage: 'en' });
  assert.deepEqual(findings, []);
});

test('a markup attribute is not a config fallback', () => {
  const findings = defaultOnceFindings({
    'scripts/a/render.mjs': `fs.writeFileSync(f, '<!doctype html><html lang="en"><body></body></html>');`,
    'scripts/b/render.mjs': `const q = question(dir, { lang = 'en' })`,
  }, { leaves: leaves({}), ownerLanguage: 'en' });
  assert.deepEqual(paths(findings), [['RT_CONFIG_DEFAULT_TWICE', 'scripts/b/render.mjs']]);
});

test('specs, tests, generated runtime and product templates are outside the law', () => {
  const findings = defaultOnceFindings({
    'tests/x.spec.mjs': `f({ language = 'vi' })`,
    'scripts/x.spec.mjs': `const m = conf.mode ?? 'chat';`,
    'packages/p/runtime/copy.mjs': `f({ language = 'vi' })`,
    'packages/hfs/templates/t.mjs': `f({ language = 'vi' })`,
    'ui/dist/bundle.js': `language ?? 'en'`,
  }, { leaves: leaves({ mode: ['chat'] }), ownerLanguage: 'en' });
  assert.deepEqual(findings, []);
});

test('documentedLeaves reads scalar leaves and walks arrays without index keys', () => {
  const doc = {
    supervisor: { workers: { base: 2, max: 6 }, landGate: { mode: 'shared' }, repos: [{ name: 'a', root: '/x' }] },
    kernel: { group: [{ agent: 'claude', model: 'm1' }, { agent: 'codex' }] },
    empty: null,
  };
  const got = documentedLeaves(doc);
  assert.deepEqual([...got.get('base')], ['2']);
  assert.deepEqual([...got.get('mode')], ['shared']);
  assert.deepEqual([...got.get('agent')].sort(), ['claude', 'codex']);
  assert.deepEqual([...got.get('root')], ['/x']);
  assert.ok(!got.has('0') && !got.has('1'));
  assert.deepEqual([...got.get('empty')], []);
});

test('commentedLeaves reads keys the example only comments about', () => {
  const got = commentedLeaves('# mode: chat|kernel — how the seat runs\n# workers: {base, max}\n# frozenMinutes: <n>\nkernel: {group: [x]}');
  assert.deepEqual([...got.get('mode')].sort(), ['chat', 'kernel']);
  assert.ok(got.has('base') && got.has('max') && got.has('frozenMinutes'));
});

test('ownerDefaults reads DEFAULTS scalars and DEFAULT_OWNER_LANGUAGE', () => {
  const home = `export const DEFAULTS = Object.freeze({ workers: { base: 2, max: 6 }, landGate: { mode: 'shared' }, frozenMinutes: 45, pollIntervalMs: 600_000 }));\nexport const DEFAULT_OWNER_LANGUAGE = 'en';`;
  const { values, language } = ownerDefaults(home);
  assert.equal(language, 'en');
  assert.deepEqual([...values.get('base')], ['2']);
  assert.deepEqual([...values.get('mode')], ['shared']);
  assert.deepEqual([...values.get('pollIntervalMs')], ['600000']);
});

test('this runtime reads every documented default through its owner', () => {
  assert.deepEqual(checkDefaultOnce(path.resolve(import.meta.dirname, '..', '..')), []);
});
