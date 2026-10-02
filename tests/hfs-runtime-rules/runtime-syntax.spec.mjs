// runtime-syntax.spec.mjs - RT_SYNTAX_INVALID (scripts/hfs/runtime-rules/syntax.mjs): every tracked JavaScript file
// parses, including specs and package sources that the runtime's Node-exact folder check does not reach.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeCheck } from '../../scripts/hfs/runtime-check.mjs';
import { syntaxFindings } from '../../scripts/hfs/runtime-rules/syntax.mjs';
import { RUNTIME_MANIFEST_FILE, loadSlotManifest } from '../../scripts/hfs/slots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANIFEST = loadSlotManifest({ root: ROOT, file: path.join(ROOT, RUNTIME_MANIFEST_FILE) });
const GENERATED = [{ root: 'packages/hfs/runtime', generatedBy: 'scripts/hfs/sync-runtime.mjs' }];
const ctxOf = (sources) => ({
  files: Object.keys(sources),
  params: { generated: GENERATED },
  read: (file) => sources[file] ?? null,
});

test('RT_SYNTAX_INVALID: a raw newline in a regex and an unclosed brace are refused with their lines', () => {
  const found = syntaxFindings(ctxOf({
    'tests/fixtures/raw-regex.mjs': ['const pattern = /alpha', 'omega/;', ''].join('\n'),
    'packages/example/unclosed.cjs': ['export function value() {', '  return 1;', ''].join('\n'),
  }));
  assert.ok(found.some((finding) => finding.path === 'tests/fixtures/raw-regex.mjs' && finding.line === 1 && /Unterminated regular expression literal/.test(finding.message)));
  assert.ok(found.some((finding) => finding.path === 'packages/example/unclosed.cjs' && finding.line === 3 && /expected/.test(finding.message)));
  assert.ok(found.every((finding) => finding.code === 'RT_SYNTAX_INVALID' && finding.message.includes(`${finding.path}:${finding.line}`)));
});

test('RT_SYNTAX_INVALID: clean modules pass and generated or vendored build trees are outside the authored-source scope', () => {
  assert.deepEqual(syntaxFindings(ctxOf({
    'tests/clean.spec.mjs': "import assert from 'node:assert/strict';\nassert.equal(1, 1);\n",
    'packages/example/index.cjs': "'use strict';\nmodule.exports = { ok: true };\n",
    'ui/config.js': 'export default { enabled: true };\n',
    'packages/hfs/runtime/broken.mjs': 'export const broken = {;\n',
    'examples/app/node_modules/pkg/index.js': 'export const broken = {;\n',
    'packages/example/dist/index.js': 'export const broken = {;\n',
    'tests/reference-renders/bundle.js': 'export const broken = {;\n',
  })), []);
});

test('RT_SYNTAX_INVALID: a managed template with a render token is not authored source, the same text outside the template tree is refused', () => {
  const text = 'module.exports = { coverage: {{jestCoverage}} };\n';
  assert.deepEqual(syntaxFindings(ctxOf({ 'packages/hfs/templates/be/tool-config/jest.config.js': text })), []);
  assert.ok(syntaxFindings(ctxOf({ 'packages/example/jest.config.js': text })).length > 0);
});

test('runtimeCheck registers RT_SYNTAX_INVALID for tracked sources outside its runtime-source subset', (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-runtime-syntax-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const files = {
    'hfs.json': '{"hfs":1,"kind":"runtime","project":"starci"}\n',
    'tests/hfs-runtime-rules/broken.spec.mjs': ['const pattern = /alpha', 'omega/;', ''].join('\n'),
  };
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    fs.writeFileSync(path.join(repo, file), text);
  }
  const result = runtimeCheck({ repoRoot: repo, root: ROOT, files: Object.keys(files), tree: false, base: null, drift: [], manifest: MANIFEST });
  const finding = result.findings.find((entry) => entry.code === 'RT_SYNTAX_INVALID');
  assert.equal(finding?.path, 'tests/hfs-runtime-rules/broken.spec.mjs');
  assert.equal(finding?.line, 1);
});
