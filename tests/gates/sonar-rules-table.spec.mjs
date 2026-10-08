import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { lintSources } from '../../scripts/gates/sonar-rules-engine.mjs';
import { NOT_COVERED, RULES } from '../../scripts/gates/sonar-rules-table.mjs';

const ROOT = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// One minimal fixture per mapped Sonar rule: the code that rule flags, and the form the fix takes (which must be quiet).
const FIXTURES = Object.freeze({
  S3776: [`export function f(a, b, c) {
  if (a) { for (const x of b) { if (x) { while (c) { if (a && b || c) { if (x) { switch (a) { case 1: if (b) return 1; } } } } } } }
  if (a) { for (const x of b) { if (x) { if (c) { return 2; } } } }
  return 0;
}\n`, 'export const f = (a) => a;\n'],
  S107: ['export const f = (a, b, c, d, e, f2, g, h) => [a, b, c, d, e, f2, g, h];\n', 'export const f = (a, b, c, d, e, f2, g) => [a, b, c, d, e, f2, g];\n'],
  S4624: ['export const f = (a, b) => `x ${`y ${a}`} ${b}`;\n', 'export const f = (a, b) => { const y = `y ${a}`; return `x ${y} ${b}`; };\n'],
  S3358: ['export const f = (a, b) => (a ? (b ? 1 : 2) : 3);\n', 'export const f = (a, b) => { if (!a) return 3; return b ? 1 : 2; };\n'],
  S1121: ['let a;\nexport const f = (g) => { if ((a = g())) return 1; return 0; };\n', 'let a;\nexport const f = (g) => { a = g(); if (a) return 1; return 0; };\n'],
  S1128: ["import os from 'node:os';\nexport const f = 1;\n", 'export const f = 1;\n'],
  S2310: ['export function f(n) { for (let i = 0; i < n; i += 1) { i = i + 2; } }\n', 'export function f(n) { for (let i = 0; i < n; i += 2) { n -= 1; } }\n'],
  S1529: ['export const f = (a, b) => (a & b ? 1 : 0);\n', 'export const f = (a, b) => (a && b ? 1 : 0);\n'],
  S2871: ['export const f = (list) => [...list].sort();\n', 'export const f = (list) => [...list].sort((a, b) => a - b);\n'],
  S5869: ['export const re = /[aa]/;\n', 'export const re = /[a]/;\n'],
  S8786: ['export const re = /a+$/;\n', 'export const re = /^a+$/;\n'],
  S9382: ['export async function f(list, g) { for (const x of list) { await g(x); } }\n', 'export async function f(list, g) { await Promise.all(list.map((x) => g(x))); }\n'],
  S4138: ['export function f(list) { let n = 0; for (let i = 0; i < list.length; i += 1) { n += list[i]; } return n; }\n', 'export function f(list) { let n = 0; for (const x of list) { n += x; } return n; }\n'],
  S7727: ['export const f = (list, valid) => list.every(valid);\n', 'export const f = (list, valid) => list.every((x) => valid(x));\n'],
  S7732: ['export const f = (v) => v instanceof Array;\n', 'export const f = (v) => Array.isArray(v);\n'],
  S7740: ['export function f() { const scope = this; return scope; }\n', 'export function f() { return this; }\n'],
  S7744: ['export const f = (a) => ({ ...(a || {}) });\n', 'export const f = (a) => ({ ...a });\n'],
  S7747: ['export const f = (set) => { for (const x of [...set]) { if (x) return x; } };\n', 'export const f = (set) => { for (const x of set) { if (x) return x; } };\n'],
  S7758: ["export const f = (n) => String.fromCharCode(n);\n", 'export const f = (n) => String.fromCodePoint(n);\n'],
  S7767: ['export const f = (n) => n | 0;\n', 'export const f = (n) => Math.trunc(n);\n'],
  S7770: ['export const f = (list) => list.map((x) => Number(x));\n', 'export const f = (list) => list.map(Number);\n'],
  S7776: ["const HELD = ['a', 'b'];\nexport const f = (s) => HELD.includes(s);\n", "const HELD = new Set(['a', 'b']);\nexport const f = (s) => HELD.has(s);\n"],
  S7778: ['export const f = (list) => { list.push(1); list.push(2); return list; };\n', 'export const f = (list) => { list.push(1, 2); return list; };\n'],
  S7780: ["export const f = '\\\\d+';\n", 'export const f = String.raw`\\d+`;\n'],
  S6582: ['export const f = (a) => { let row = null; row = a; return row && row.id; };\n', 'export const f = (a) => { let row = null; row = a; return row?.id; };\n'],
  S9383: ['async function save() { return 1; }\nexport const f = () => { save(); };\n', 'async function save() { return 1; }\nexport const f = () => { void save(); };\n'],
  S1516: ["export const f = '\\u2028';\n", "export const f = String.fromCodePoint(0x2028);\n"],
});

const found = async (source) => (await lintSources(ROOT, [{ file: 'fixture.mjs', source }])).map((finding) => finding.rule);

test('every rule of the table has a fixture, and no fixture names a rule the table lacks', () => {
  assert.deepEqual(Object.keys(FIXTURES).sort(), RULES.map((entry) => entry.sonar).sort());
});

for (const entry of RULES) {
  test(`${entry.sonar} (${entry.rule}) fires on its fixture and stays quiet on the fixed form`, async () => {
    const [bad, good] = FIXTURES[entry.sonar];
    assert.ok((await found(bad)).includes(entry.sonar), `${entry.sonar} must fire on:\n${bad}`);
    assert.deepEqual(await found(good), [], `the fixed form of ${entry.sonar} must be clean:\n${good}`);
  });
}

test('the S7727 rule leaves one-parameter function references alone, as SonarCloud does', async () => {
  assert.deepEqual(await found('const norm = (x) => x;\nexport const f = (list) => list.map(norm);\n'), []);
  assert.ok((await found('const two = (x, y) => x + y;\nexport const f = (list) => list.map(two);\n')).includes('S7727'));
  assert.ok((await found("export const f = (list) => list.map(parseInt);\n")).includes('S7727'));
});

test('the S2871 rule leaves arrays that are evidently strings alone', async () => {
  assert.deepEqual(await found("import fs from 'node:fs';\nexport const f = (d) => fs.readdirSync(d).filter((n) => n.endsWith('.mjs')).sort();\n"), []);
  assert.deepEqual(await found('export const f = (o) => Object.keys(o).sort();\n'), []);
});

test('the S6582 rule needs the value to be nullable and reports the chain once', async () => {
  assert.deepEqual(await found('export const f = (a) => a && a.b;\n'), []);
  const chain = await found('export const f = (a) => { let x = null; x = a; return x && x.b && x.b.c; };\n');
  assert.equal(chain.filter((id) => id === 'S6582').length, 1);
});

test('the S9383 rule accepts awaited, voided and settled promises', async () => {
  const lines = [
    'export const a = async (p) => { await p.then((v) => v); };',
    'export const b = (p) => { p.then((v) => v, () => null); };',
    'export const c = (p) => { p.then((v) => v).catch(() => null); };',
  ];
  assert.deepEqual(await found(`${lines.join('\n')}\n`), []);
  assert.deepEqual(await found('export const d = (p) => { p.then((v) => v); };\n'), ['S9383']);
  assert.deepEqual(await found('export const e = () => { Promise.resolve(1); };\n'), ['S9383']);
});

test('inline suppressions do not silence a rule', async () => {
  assert.ok((await found('// eslint-disable-next-line no-await-in-loop\nexport async function f(l, g) { for (const x of l) { await g(x); } }\n')).includes('S9382'));
});

test('the Sonar ids this project was flagged for but that need a data-flow engine are listed with their reason', () => {
  assert.ok(NOT_COVERED.length > 0);
  for (const entry of NOT_COVERED) assert.ok(entry.sonar && entry.reason, JSON.stringify(entry));
  const mapped = new Set(RULES.map((entry) => entry.sonar));
  for (const entry of NOT_COVERED) assert.ok(!mapped.has(entry.sonar), `${entry.sonar} is both mapped and not covered`);
});
