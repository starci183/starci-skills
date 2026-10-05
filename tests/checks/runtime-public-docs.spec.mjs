import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { main, publicDocFindings, scanRuntimePublicDocs } from '../../scripts/checks/check-runtime-public-docs.mjs';
import { checkRuntimeMain, runtimeOnlyChecks } from '../../scripts/checks/check-runtime.mjs';
import { RUNTIME_MANIFEST_FILE, createSlotResolver, loadSlotManifest, resolveRepoDeclaration, ruleParams } from '../../scripts/hfs/slots.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = loadSlotManifest({ root, file: path.join(root, RUNTIME_MANIFEST_FILE) });
const resolver = createSlotResolver(manifest, resolveRepoDeclaration(manifest, { hfs: manifest.major, kind: 'runtime' }));
const catalog = (module, selected = 'run') => ({ groups: [{ group: 'probe', verbs: [{ verb: 'run', impl: { module, export: selected } }] }] });
const check = (sources, commands = { groups: [] }, extra = {}) => publicDocFindings({ files: Object.keys(sources), read: (file) => sources[file], resolver, catalog: commands, ...extra });
const apiFile = 'scripts/api/http/probe.mjs';
const cliFile = 'scripts/machine/probe.mjs';

test('a native API without adjacent JSDoc reports the actual selected definition', () => {
  const report = check({ [apiFile]: 'export function probe() { return false; }' });
  assert.equal(report.ok, false);
  assert.equal(report.selected, 1);
  assert.equal(report.definitions, 1);
  assert.deepEqual(report.findings.map(({ code, path: file, symbol, line }) => ({ code, file, symbol, line })),
    [{ code: 'RT_PUBLIC_JSDOC', file: apiFile, symbol: 'probe', line: 1 }]);
});

test('empty, punctuation-only, tag-only and ordinary comments do not document an API', () => {
  for (const comment of ['/** */', '/**\n *\n */', '/** ... */', '/** @param {string} url */', '// Run the probe.', '/* Run the probe. */']) {
    assert.equal(check({ [apiFile]: `${comment}\nexport const probe = () => false;` }).ok, false, comment);
  }
});

test('an actual descriptive JSDoc is sufficient without a boilerplate tag quota', () => {
  for (const declaration of ['export function probe() { return false; }', 'export const probe = () => false;', 'export const probe = function () { return false; };']) {
    assert.equal(check({ [apiFile]: `/** Return readiness without causing host effects. */\n${declaration}` }).ok, true);
  }
  assert.equal(check({ [apiFile]: '/** Return readiness.\n * @returns {boolean} readiness\n */\nexport function probe() { return false; }' }).ok, true);
});

test('a generic file header, separated doc and comment-looking strings do not pass', () => {
  const sources = [
    '/** Probe readiness. */\nimport x from "node:path";\nexport function probe() { return false; }',
    '/** Probe readiness. */\n// Another comment.\nexport function probe() { return false; }',
    'const text = "/** Probe readiness. */";\nexport function probe() { return text; }',
    'export function probe() { const fake = `/** Probe readiness. */`; return fake; }',
  ];
  for (const source of sources) assert.equal(check({ [apiFile]: source }).ok, false);
});

test('private helpers, exported data and API runners have no automatic callable-doc quota', () => {
  const report = check({
    'scripts/lib/probe.mjs': 'export function internal() {}\nexport const DATA = 7;',
    'scripts/api/http/lib.mjs': 'export function transport() {}',
    [apiFile]: '/** Return native readiness. */\nexport function probe() {}\nfunction privateHelper() {}',
  });
  assert.equal(report.ok, true);
  assert.equal(report.selected, 1);
});

test('explicit CLI bindings select factory-valued exports instead of silently skipping them', () => {
  const code = 'export const run = lockOperation(async () => ({code: 0}));';
  assert.equal(check({ [cliFile]: code }, catalog(cliFile)).ok, false);
  assert.equal(check({ [cliFile]: `/** Run under the native operation lock. */\n${code}` }, catalog(cliFile)).ok, true);
});

test('a selected class binding requires its definition description; unselected classes are not guessed public', () => {
  assert.equal(check({ [cliFile]: 'export class run {}' }, catalog(cliFile)).ok, false);
  assert.equal(check({ [cliFile]: '/** The declared callable boundary. */\nexport class run {}' }, catalog(cliFile)).ok, true);
  assert.equal(check({ [cliFile]: 'export class internal {}' }).selected, 0);
});

test('CLI aliases and reexports resolve their one authored definition without demanding duplicate comments', () => {
  const sources = {
    [cliFile]: 'export { handler as run } from "./probe-owner.mjs";',
    'scripts/machine/probe-owner.mjs': '/** Return the bounded operation result. */\nexport function handler() {}',
  };
  assert.equal(check(sources, catalog(cliFile)).ok, true);
  sources['scripts/machine/probe-owner.mjs'] = 'export function handler() {}';
  const report = check(sources, catalog(cliFile));
  assert.equal(report.ok, false);
  assert.equal(report.findings[0].path, 'scripts/machine/probe-owner.mjs');
  assert.deepEqual(report.findings[0].contracts, ['starci probe run']);
});

test('local aliases, named imports and default definitions retain declaration custody', () => {
  for (const entry of ['const handler = () => {};\nexport { handler as run };', 'import {handler} from "./probe-owner.mjs";\nexport { handler as run };', 'import handler from "./probe-owner.mjs";\nexport { handler as run };']) {
    const local = entry.startsWith('const') ? '/** Return the declared result. */\n' : '';
    const owner = entry.includes('import handler') ? '/** Return the declared result. */\nexport default function handler() {}' : '/** Return the declared result. */\nexport const handler = () => {};';
    assert.equal(check({ [cliFile]: local + entry, 'scripts/machine/probe-owner.mjs': owner }, catalog(cliFile)).ok, true);
  }
});

test('multiple CLI routes to one definition produce one missing-doc finding with both contracts', () => {
  const commands = catalog(cliFile);
  commands.groups[0].verbs.push({ verb: 'status', impl: { module: cliFile, export: 'run' } });
  const report = check({ [cliFile]: 'export function run() {}' }, commands);
  assert.equal(report.findings.length, 1);
  assert.deepEqual(report.findings[0].contracts, ['starci probe run', 'starci probe status']);
});

test('script implementations and package-dispatched commands do not invent an exported public binding', () => {
  const commands = { groups: [{ group: 'probe', verbs: [{ verb: 'script', impl: { script: cliFile } }, { verb: 'app', impl: null }] }] };
  assert.equal(check({ [cliFile]: 'export function privateHelper() {}' }, commands).selected, 0);
});

test('missing, cyclic, external and ambiguous star-only exported owners fail closed', () => {
  for (const sources of [
    { [cliFile]: 'export function other() {}' },
    { [cliFile]: 'export {run} from "./absent.mjs";' },
    { [cliFile]: 'export {run} from "external-package";' },
    { [cliFile]: 'export {run} from "./probe-owner.mjs";', 'scripts/machine/probe-owner.mjs': 'export {run} from "./probe.mjs";' },
    { [cliFile]: 'export * from "./probe-owner.mjs";', 'scripts/machine/probe-owner.mjs': '/** Run. */\nexport function run() {}' },
  ]) assert.throws(() => check(sources, catalog(cliFile)), /RT_PUBLIC_DOCS_INPUT/);
});

test('API shape, parsing and malformed catalog bindings cannot become a green empty scope', () => {
  assert.throws(() => check({ [apiFile]: '/** Unrelated. */\nexport function other() {}' }), /RT_PUBLIC_DOCS_INPUT/);
  assert.throws(() => check({ [cliFile]: 'export function run( {' }, catalog(cliFile)), /RT_PUBLIC_DOCS_INPUT/);
  assert.throws(() => check({ [cliFile]: '' }, catalog('../escape.mjs')), /RT_PUBLIC_DOCS_INPUT/);
  assert.throws(() => check({ [cliFile]: '' }, catalog(cliFile, 'not-valid')), /RT_PUBLIC_DOCS_INPUT/);
  assert.throws(() => check({}, {}), /RT_PUBLIC_DOCS_INPUT/);
});

test('unreadable selected source and unavailable existing compiler tooling never pass', () => {
  assert.throws(() => publicDocFindings({ files: [apiFile], read: () => null, resolver, catalog: { groups: [] } }), /RT_PUBLIC_DOCS_INPUT/);
  assert.throws(() => check({}, { groups: [] }, { compiler: () => { throw new Error('TypeScript tooling unavailable'); } }), /TypeScript tooling unavailable/);
  let stdout = '', stderr = '';
  const io = { stdout: { write: (s) => { stdout += s; } }, stderr: { write: (s) => { stderr += s; } } };
  assert.equal(main(['--json'], io, { scan: () => { throw new Error('TypeScript tooling unavailable'); } }), 2);
  assert.equal(stdout, '');
  assert.match(stderr, /TypeScript tooling unavailable/);
});

test('the filesystem scan uses the declared runtime and a new current-tree public module', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-public-docs-'));
  try {
    fs.writeFileSync(path.join(fixture, 'hfs.json'), JSON.stringify({ hfs: manifest.major, kind: 'runtime' }));
    const source = 'export function probe() {}';
    const report = scanRuntimePublicDocs(fixture, { manifest, files: [apiFile], read: () => source, catalog: { groups: [] } });
    assert.equal(report.ok, false);
    assert.equal(report.findings[0].path, apiFile);
    fs.writeFileSync(path.join(fixture, 'hfs.json'), '{}');
    assert.throws(() => scanRuntimePublicDocs(fixture, { manifest, files: [apiFile], read: () => source, catalog: { groups: [] } }));
  } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
});

test('the named entry and full runtime self-check inventory both retain the real gate', () => {
  const selected = runtimeOnlyChecks(root).find((entry) => entry.name === 'runtime-public-docs');
  assert.equal(selected?.run, 'scripts/checks/check-runtime-public-docs.mjs');
  assert.ok(ruleParams(manifest, 'runtime').selfChecks.some((entry) => entry.id === selected.name && entry.run === selected.run));
  let call;
  assert.equal(checkRuntimeMain(['--only', 'runtime-public-docs', '--', '--json'], { root, runner: (script, args) => { call = { script, args }; return 1; } }), 1);
  assert.equal(call.script, path.join(root, selected.run));
  assert.deepEqual(call.args, ['--json']);
});
