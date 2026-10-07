import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkUndeclaredIdentifiers, CODE } from '../../scripts/checks/check-undeclared-identifiers.mjs';
import { undeclaredNames } from '../../scripts/lib/undeclared-names.mjs';
import { parseSource, ts } from '../../scripts/hfs/runtime-rules/source-ast.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const REFUSAL = 'RT_IDENTIFIER_UNDECLARED';
const namesIn = (text) => undeclaredNames(ts(), parseSource(text, 'x.mjs')).map((f) => f.name);

test('an identifier whose import left with the code that used it is reported (checkStarciworkBoundary)', () => {
  assert.deepEqual(namesIn([
    "import { relativePath } from './path.mjs';",
    'export function repoFindings(root) {',
    '  return checkStarciworkBoundary(root).map((f) => relativePath(f));',
    '}',
  ].join('\n')), ['checkStarciworkBoundary']);
});

test('a name the extracted function no longer receives is reported (catalog)', () => {
  assert.deepEqual(namesIn([
    "import { catalogLine } from './catalog.mjs';",
    'const scoredWhy = ({ rep, primary, done }) => done({ cause: catalogLine(primary, catalog), summary: rep.summary });',
  ].join('\n')), ['catalog']);
});

test('a loop variable read by a function extracted out of the loop is reported (key)', () => {
  assert.deepEqual(namesIn([
    'const rows = [];',
    'const map = { a: 1 };',
    'function describe(entry) { return `${key}: ${entry}`; }',
    'for (const key of Object.keys(map)) rows.push(describe(map[key]));',
  ].join('\n')), ['key']);
});

test('a re-export binds nothing locally, so reading the re-exported name is reported (ALLOW_FILE)', () => {
  assert.deepEqual(namesIn([
    "export { ALLOW_FILE } from './allow.mjs';",
    'export const allowed = (file) => file === ALLOW_FILE;',
  ].join('\n')), ['ALLOW_FILE']);
  assert.deepEqual(namesIn("import { ALLOW_FILE } from './allow.mjs';\nexport { ALLOW_FILE };\nexport const allowed = (file) => file === ALLOW_FILE;"), []);
  assert.deepEqual(namesIn('export { missing as alias };'), ['missing'], 'a local export list reads the local name');
});

test('every binding form resolves: imports, parameters, patterns, var, let, classes, functions, catch, loops and labels', () => {
  assert.deepEqual(namesIn([
    "import fs, { readFileSync as read } from 'node:fs';",
    "import * as path from 'node:path';",
    'export const a = 1, { b, c: [d, ...e], ...f } = process.env;',
    'export function g({ h, i = h }, [j], ...k) { return [arguments.length, h, i, j, k, fs, read, path, a, b, d, e, f]; }',
    'export default class Named extends Map { static #p = 1; field = Named; static { const own = Named; own; } get n() { return this.field; } }',
    'const fx = function self(n) { return n ? self(n - 1) : 0; };',
    'function later() { return hoisted + typeof absent + (typeof require === "undefined"); }',
    'var hoisted = 1;',
    'try { fx(1); } catch ({ message }) { message; } finally { later(); }',
    'try { later(); } catch { /* none */ }',
    'outer: for (let n = 0, m = 1; n < m; n += 1) { for (const key in { n }) { if (key) continue outer; else break outer; } }',
    'for (var v of [1]) { v; }',
    'if (true) { var inner = 1; function block() { return inner; } block(); }',
    'switch (1) { case 1: { let scoped = 1; scoped; } default: let shared = 2; shared; }',
    'const shorthand = { a, b, [d]: 1, get d2() { return 1; }, method() { return new.target; } };',
    'export const url = import.meta.url; shorthand; v; inner;',
    'new Set([NaN, Infinity, undefined]); globalThis; setTimeout; structuredClone; URL; Buffer; AbortController; Symbol; WeakRef;',
  ].join('\n')), []);
});

test('a property name, a label, a method name and a quoted key are never read as a value', () => {
  assert.deepEqual(namesIn('const o = { unknownKey: 1, "quoted": 2 }; o.unknownProp; o?.other; class A { missingMethod() {} static unknownField = 1; }'), []);
  assert.deepEqual(namesIn('const o = { shorthand }; o;'), ['shorthand'], 'a shorthand property reads the name');
  assert.deepEqual(namesIn('const f = () => arguments.length; f;'), ['arguments'], 'an arrow at module level has no arguments');
});

test('what a module does not have is reported: require, module, exports and __dirname', () => {
  assert.deepEqual(namesIn("const fs = require('node:fs'); module.exports = { dir: __dirname, exports };"), ['require', 'module', '__dirname', 'exports']);
});

test('browser globals are known only inside a function that runs in a page', () => {
  assert.deepEqual(namesIn([
    'export async function shoot(page) {',
    '  await page.evaluate(() => document.title + getComputedStyle(document.body).color);',
    '  await page.evaluate(measure, { n: 1 });',
    '  return document.title;',
    '}',
    'function measure({ n }) { return window.innerWidth + n; }',
    'function elsewhere() { return window.innerWidth; }',
  ].join('\n')), ['document', 'window']);
});

test('the functions a module assembles into a page script run in the page', () => {
  assert.deepEqual(namesIn([
    'export function measureInPage(page, arg) {',
    '  return page.evaluate(pageScript(measure, [visible, tagOf]), arg);',
    '}',
    'function measure(arg) { return tagOf(document.body) + visible(arg); }',
    'function visible(el) { return getComputedStyle(el).display; }',
    'function tagOf(el) { return el.tagName + innerWidth; }',
    'function node(el) { return document.title; }',
    'function pageScript(entry, functions, arg) { return `${entry.name}${functions.length}${arg}`; }',
  ].join('\n')), ['document']);
});

test('a function a module passes to page.evaluate through an import and a re-export runs in the page', (t) => {
  const root = mkdtemp(t, 'starci-undeclared-ids-');
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  write('scripts/render.mjs', "import { measure } from './page/index.mjs';\nexport const run = (page) => page.evaluate(measure, 1);\n");
  write('scripts/page/index.mjs', "export { measure } from './measure.mjs';\n");
  write('scripts/page/measure.mjs', 'export function measure(n) { return document.body.scrollWidth + n; }\nexport function notInPage() { return document.title; }\n');
  write('scripts/lonely.mjs', 'export const broken = () => missingHelper();\n');
  write('engine/yaml.mjs', 'export const vendored = () => notDeclaredButVendored;\n');
  write('ui/api/handler.mjs', 'export const handler = (req) => req.body;\n');
  write('packages/cli/src/main.mjs', 'export const main = () => absentFromCli;\n');
  write('scripts/node_modules/dep/index.mjs', 'export const dep = () => ignored;\n');
  const findings = checkUndeclaredIdentifiers(root);
  assert.equal(CODE, REFUSAL);
  assert.deepEqual(findings.map((f) => [f.code, f.path]), [
    [REFUSAL, 'scripts/lonely.mjs'],
    [REFUSAL, 'scripts/page/measure.mjs'],
    [REFUSAL, 'packages/cli/src/main.mjs'],
  ]);
  assert.match(findings[2].message, /^packages\/cli\/src\/main\.mjs:1:\d+ "absentFromCli" is read or written but no declaration/);
  assert.match(findings[1].message, /measure\.mjs:2:\d+ "document"/, 'only the function the render module passes to the page sees the browser globals');
});

test('the runtime tree itself has no undeclared identifier', () => {
  assert.deepEqual(checkUndeclaredIdentifiers().filter((f) => f.code === REFUSAL).map((f) => f.message), []);
});
