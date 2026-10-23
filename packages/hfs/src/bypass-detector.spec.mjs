// No bypass lands unnoticed (owner ruling loosening-always-red). Two readers share one marker table (scripts/lib/bypass-markers.mjs):
//   - the runtime detector (scripts/lib/gate-loosening.mjs + scripts/lib/check-code-loosening.mjs) judges the diff of a change to the code of
//     a check: the check scripts, the canon templates, the lint packages, workflows and hooks;
//   - the product rule HFS_BYPASS_MARKER (scripts/hfs/rules/bypass-markers.mjs) and `starci app hygiene` (the pre-commit hook) judge a tree
//     and the index.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { looseningsOf, loosensReleased, parseDiff } from '../runtime/scripts/lib/gate-loosening.mjs';
import { bypassesIn } from '../runtime/scripts/lib/bypass-markers.mjs';
import { bypassMarkerFindings } from '../runtime/scripts/hfs/rules/bypass-markers.mjs';
import { runWorkHygiene } from '../sync/hygiene.mjs';

const RULES = Object.freeze({
  gateFiles: ['modules/host/orca/api.yaml'],
  allowlistFiles: [],
  checkCode: ['scripts/checks/', 'scripts/hfs/rules/', 'packages/hfs/templates/', 'packages/eslint/', '.github/workflows/', 'packages/hfs/release/gate.mjs'],
  thresholds: { floors: ['min', 'branches'], ceilings: ['max'] },
  productPrefixes: ['scripts/'],
  specRoots: ['examples/'],
  skipMarkers: ['.skip('],
  assertionMarkers: ['expect('],
});

/** A unified diff (`--no-renames -U0`) from { file: { removed, added, section?, deleted? } }. */
const diffOf = (files) => Object.entries(files).flatMap(([name, { removed = [], added = [], section = '', deleted = false }]) => [
  `diff --git a/${name} b/${name}`, ...(deleted ? ['deleted file mode 100644'] : []), `--- a/${name}`, `+++ b/${deleted ? '/dev/null' : name}`,
  `@@ -1 +1 @@${section ? ` ${section}` : ''}`, ...removed.map((line) => `-${line}`), ...added.map((line) => `+${line}`),
]).join('\n');

const kindsOf = (files, options) => looseningsOf(diffOf(files), RULES, options).map((finding) => `${finding.kind} ${finding.file}`);
const join = (...parts) => parts.join('');

test('a bypass marker added to a check script is a loosening, in every shape the table names', () => {
  const added = [
    join('// eslint', '-disable-next-line no-undef'), join('/* eslint', '-disable */'), join('// @ts', '-ignore'), join('// @ts', '-expect-error because'),
    join('// NO', 'SONAR'), join('/* istanbul', ' ignore next */'), join('// c8', ' ignore next'), join('// stylelint', '-disable color-no-hex'),
    "describe.skip('x', () => {});", "it.only('x', () => {});", "xit('x', () => {});", "test('x', { skip: process.platform === 'win32' }, () => {});",
  ];
  for (const line of added) {
    assert.deepEqual(kindsOf({ 'scripts/checks/check-x.mjs': { added: [line] } }), ['bypass-added scripts/checks/check-x.mjs'], line);
  }
});

test('a failure swallowed in a hook template, a workflow or a package script is a loosening', () => {
  assert.deepEqual(kindsOf({ 'packages/hfs/templates/app/hooks/husky/pre-commit': { added: ['npx eslint . || true'] } }), ['bypass-added packages/hfs/templates/app/hooks/husky/pre-commit']);
  assert.deepEqual(kindsOf({ '.github/workflows/ci.yml': { added: ['        continue-on-error: true'] } }), ['bypass-added .github/workflows/ci.yml']);
  assert.deepEqual(kindsOf({ '.github/workflows/ci.yml': { added: ['          fail_ci_if_error: false'] } }), ['bypass-added .github/workflows/ci.yml']);
  assert.deepEqual(kindsOf({ 'packages/hfs/templates/app/package-scripts/package.json': { added: ['    "test": "jest --passWithNoTests",'] } }), ['bypass-added packages/hfs/templates/app/package-scripts/package.json']);
  assert.deepEqual(kindsOf({ 'packages/hfs/templates/app/hooks/husky/pre-push': { added: ['  for tag in $(git tag --list 2>/dev/null || true); do'] } }), [], 'a query inside a substitution is no bypass');
  assert.deepEqual(kindsOf({ '.github/workflows/ci.yml': { added: ['        continue-on-error: false'] } }), []);
});

test('a marker spelled inside a string, or in a file that is no check, is no bypass; a marker that only moves is no addition', () => {
  assert.deepEqual(kindsOf({ 'scripts/checks/check-x.mjs': { added: [`const BANNED = '${join('eslint', '-disable')}';`] } }), []);
  assert.deepEqual(kindsOf({ 'scripts/other/tool.mjs': { added: [join('// eslint', '-disable-next-line x')] } }), []);
  assert.deepEqual(kindsOf({ 'packages/eslint/be/rule.spec.mjs': { added: ["it.skip('fixture', () => {});"] } }), [], 'a spec or a fixture spells markers on purpose');
  const moved = join('// NO', 'SONAR');
  assert.deepEqual(kindsOf({ 'scripts/checks/a.mjs': { removed: [moved] }, 'scripts/checks/b.mjs': { added: [moved] } }), []);
});

test('a ban list loses an entry: a forbidden-list verb, a pattern-table row, a quoted entry', () => {
  assert.deepEqual(kindsOf({ 'modules/host/orca/api.yaml': { removed: ['  - terminal create'] } }), ['check-removed modules/host/orca/api.yaml']);
  const row = "  [/\\bterminalCreate\\b/,'the terminalCreate wrapper'],";
  assert.deepEqual(kindsOf({ 'scripts/checks/check-host-boundary.mjs': { removed: [row] } }), ['check-removed scripts/checks/check-host-boundary.mjs']);
  assert.deepEqual(kindsOf({ 'scripts/checks/check-host-boundary.mjs': { removed: ["  'terminal create',"] } }), ['check-removed scripts/checks/check-host-boundary.mjs']);
  assert.deepEqual(kindsOf({ 'scripts/checks/a.mjs': { removed: [row] }, 'scripts/checks/b.mjs': { added: [row] } }), [], 'a row moved to another file stays');
  assert.deepEqual(kindsOf({ 'scripts/checks/gone.mjs': { removed: [row], deleted: true } }), [], 'a deleted script is judged by its registration, not here');
});

test('a check that loses enforcement lines in a change is weakened; one that gains as many is not', () => {
  const fail = "  findings.push({ code: CODE, path: file, message: 'x' });";
  assert.deepEqual(kindsOf({ 'scripts/hfs/rules/x.mjs': { removed: [fail, "  process.exitCode = 1;"] } }), ['check-weakened scripts/hfs/rules/x.mjs']);
  assert.deepEqual(kindsOf({ 'scripts/hfs/rules/x.mjs': { removed: [fail], added: [fail.replace('x', 'y')] } }), []);
  assert.deepEqual(kindsOf({ 'scripts/hfs/rules/x.mjs': { removed: [fail] }, 'scripts/hfs/rules/y.mjs': { added: [fail.replace('x', 'y')] } }), [], 'a rule split into two files keeps its lines');
  assert.deepEqual(kindsOf({ 'scripts/hfs/rules/x.mjs': { removed: ['  expect(a).toBe(1);'], added: ['  const a = 1;'] } }), ['check-weakened scripts/hfs/rules/x.mjs']);
});

test('an exemption widened: a new ignore entry, skipLibCheck on, an ignore-file line more; a rewritten line is no widening', () => {
  assert.deepEqual(kindsOf({ 'packages/hfs/templates/app/tool-config/tsconfig.json': { added: ['    "skipLibCheck": true,'] } }), ['scope-widened packages/hfs/templates/app/tool-config/tsconfig.json']);
  assert.deepEqual(kindsOf({ 'packages/hfs/templates/app/tool-config/tsconfig.json': { removed: ['  "exclude": ["a"],'], added: ['  "exclude": ["a", "b"],'] } }), ['scope-widened packages/hfs/templates/app/tool-config/tsconfig.json']);
  assert.deepEqual(kindsOf({ 'packages/hfs/templates/app/tool-config/tsconfig.json': { removed: ['  "exclude": ["a", "b"],'], added: ['  "exclude": ["a"],'] } }), []);
  assert.deepEqual(kindsOf({ 'packages/hfs/templates/app/tool-config/prettierignore': { added: ['**/generated/**'] } }), ['scope-widened packages/hfs/templates/app/tool-config/prettierignore']);
  assert.deepEqual(kindsOf({ 'packages/hfs/templates/app/tool-config/prettierignore': { removed: ['**/messages/**'], added: ['**/i18n/messages/**'] } }), []);
  assert.deepEqual(kindsOf({ 'packages/hfs/templates/app/quality-config/codecov.yml': { added: ['  - "src/new/**"'], section: 'ignore:' } }), ['scope-widened packages/hfs/templates/app/quality-config/codecov.yml']);
  assert.deepEqual(kindsOf({ 'packages/hfs/templates/app/quality-config/codecov.yml': { added: ['  - component_id: x'], section: 'component_management:' } }), []);
});

test('a lowered coverage floor in a template is a loosening', () => {
  assert.deepEqual(kindsOf({ 'packages/eslint/be/lib/config.mjs': { removed: ['  branches: 100,'], added: ['  branches: 90,'] } }), ['threshold-lowered packages/eslint/be/lib/config.mjs']);
});

test('parseDiff keeps the hunk header an added line sits under', () => {
  const [file] = parseDiff(diffOf({ 'codecov.yml': { added: ['  - a'], section: 'ignore:' } }));
  assert.deepEqual(file.under.get('  - a'), ['ignore:']);
});

test('released state: a bypass loosens while its line still stands at HEAD, and not once it is folded away', () => {
  const finding = { kind: 'bypass-added', file: 'scripts/checks/x.mjs', detail: 'x', text: join('// NO', 'SONAR') };
  const read = (text) => () => text;
  assert.equal(loosensReleased(finding, { base: 'r', read: read(`a\n  ${finding.text}\n`), rules: RULES }), true);
  assert.equal(loosensReleased(finding, { base: 'r', read: read('a\n'), rules: RULES }), false);
});

test('the product table reads each kind of file with its own patterns', () => {
  const labels = (file, text) => bypassesIn(file, text).map((hit) => `${hit.line}:${hit.label}`);
  assert.deepEqual(labels('fe/src/a.tsx', `const a = 1;\n${join('// eslint', '-disable-next-line')}\n`), [`2:${join('eslint', '-disable')}`]);
  assert.deepEqual(labels('be/src/a.ts', `${join('// @ts', '-nocheck')}\n`), [`1:${join('@ts', '-nocheck')}`]);
  assert.deepEqual(labels('fe/src/a.css', `${join('/* stylelint', '-disable */')}\n`), [`1:${join('stylelint', '-disable')}`]);
  assert.deepEqual(labels('be/src/a.spec.ts', "describe.only('x', () => {});\n"), ['1:a skipped or focused test']);
  assert.deepEqual(labels('.husky/pre-commit', 'npx eslint . || true\n'), ['1:a failure swallowed with `|| true`']);
  assert.deepEqual(labels('.husky/pre-commit', '# a note: || true\nHUSKY=0 git commit\n'), ['2:HUSKY=0']);
  assert.deepEqual(labels('.github/workflows/ci.yml', '      - run: npm test\n        continue-on-error: true\n'), [`2:${join('continue', '-on-error')}`]);
  assert.deepEqual(labels('package.json', '  "scripts": {\n    "lint": "eslint . || true"\n  }\n'), ['2:a failure swallowed with `|| true`']);
  assert.deepEqual(labels('README.md', `${join('// eslint', '-disable')}\n`), []);
  assert.deepEqual(labels('node_modules/x/index.js', `${join('// eslint', '-disable')}\n`), []);
  assert.deepEqual(labels('fe/src/a.ts', "const skip = { skip: false };\nconst url = 'http://x.test/@ts-ignore';\n"), []);
});

const gitEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
const git = (cwd, ...args) => {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8', env: gitEnv, windowsHide: true });
  assert.equal(run.status, 0, `git ${args.join(' ')}: ${run.stderr}`);
};
const write = (root, file, text) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
};

test('HFS_BYPASS_MARKER: the tree rule and the staged pre-commit guard refuse a bypass, also in a front end that has no specs', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-bypass-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q', '-b', 'main');
  write(root, 'fe/src/ok.ts', 'export const ok = 1;\n');
  write(root, 'fe/src/bad.ts', `export const bad = 1; ${join('// eslint', '-disable-line')}\n`);
  write(root, 'be/src/bad.service.spec.ts', "it.skip('x', () => {});\n");
  write(root, '.husky/pre-commit', 'npx stylelint fe || true\n');
  git(root, 'add', '-A');
  const found = bypassMarkerFindings({ repoRoot: root, files: ['fe/src/ok.ts', 'fe/src/bad.ts', 'be/src/bad.service.spec.ts', '.husky/pre-commit'] });
  assert.deepEqual(found.map((finding) => finding.path), ['fe/src/bad.ts', 'be/src/bad.service.spec.ts', '.husky/pre-commit']);
  assert.ok(found.every((finding) => finding.code === 'HFS_BYPASS_MARKER' && finding.level === 'error'));
  const lines = [];
  assert.equal(await runWorkHygiene({ cwd: root, out: (line) => lines.push(line) }), 1);
  assert.equal(lines.filter((line) => line.startsWith('HFS_BYPASS_MARKER ')).length, 3, lines.join('\n'));
  assert.match(lines.find((line) => line.includes('fe/src/bad.ts')), /fe\/src\/bad\.ts:1 spells/);
});

test('the pre-commit hook ends on every failing step: the stylelint step cannot be skipped', () => {
  const hook = fs.readFileSync(new URL('../templates/app/hooks/husky/pre-commit', import.meta.url), 'utf8');
  const commands = hook.split(/\r?\n/).filter((line) => line.trim() && !line.trimStart().startsWith('#') && !line.includes('{{'));
  const pipelines = commands.join('\n').split(/\n(?=\S)/);
  assert.ok(pipelines.length >= 6, 'hygiene, sync check, eslint per side, stylelint, prettier');
  for (const pipeline of pipelines) assert.match(pipeline, /\|\| exit \$\?\s*$/, `${pipeline.split('\n')[0]} ends the hook when it fails`);
  assert.match(hook, /starci app hygiene \|\| exit/);
  assert.match(hook, /npx stylelint "\$@"/);
  assert.doesNotMatch(hook, /if \[ -n "\$styles" \]/);
  assert.doesNotMatch(hook, /\|\| true|set \+e|--no-verify/);
});
