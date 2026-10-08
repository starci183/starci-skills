// runtime-hfs-rules.spec.mjs - the runtime HFS check (scripts/hfs/runtime-check.mjs) and its rule modules
// (scripts/hfs/runtime-rules/*): for every runtime rule of knowledge/hfs/rules.yaml a violating case and a passing one,
// read from source texts and small fixture trees.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUNTIME_MANIFEST_FILE, createSlotResolver, loadSlotManifest, resolveRepoDeclaration, ruleParams } from '../../scripts/hfs/slots.mjs';
import { baseRevision, runtimeCheck } from '../../scripts/hfs/runtime-check.mjs';
import { add as gitAdd } from '../../scripts/api/git/add.mjs';
import { commit as gitCommit } from '../../scripts/api/git/commit.mjs';
import { init as gitInit } from '../../scripts/api/git/init.mjs';
import { parseSource } from '../../scripts/hfs/runtime-rules/source-ast.mjs';
import { fileExternalFindings, ownerIdOf } from '../../scripts/hfs/runtime-rules/external-owner.mjs';
import { fileBaseFindings } from '../../scripts/hfs/runtime-rules/base-pure.mjs';
import { ciUploadFindings } from '../../scripts/hfs/runtime-rules/ci-upload.mjs';
import { gitTriggerFindings, workflowTriggerFindings } from '../../scripts/hfs/runtime-rules/git-triggers.mjs';
import { changelogSection, releaseNotesFindings, releaseNotesRepoFindings } from '../../scripts/hfs/runtime-rules/release-notes.mjs';
import { callExportFinding, callFunctionName, contractCallIds } from '../../scripts/hfs/runtime-rules/api-shape.mjs';
import { packageSlotsOf, specPlacementFinding } from '../../scripts/hfs/runtime-rules/test-layout.mjs';
import { nameFindings, sourceNameFindings } from '../../scripts/hfs/runtime-rules/source-name.mjs';
import { pinnedFindings } from '../../scripts/hfs/runtime-rules/pinned.mjs';
import { sizeFindings } from '../../scripts/hfs/runtime-rules/size.mjs';
import { tierFindings } from '../../scripts/hfs/runtime-rules/tier-direction.mjs';
import { fileLinkFindings } from '../../scripts/hfs/runtime-rules/node-modules-link.mjs';
import { controlCharFinding } from '../../scripts/hfs/runtime-rules/control-chars.mjs';
import { absolutePathFindings, absolutePathRepoFindings } from '../../scripts/hfs/runtime-rules/absolute-path.mjs';
import { generatedUntrackedFindings } from '../../scripts/hfs/runtime-rules/generated-untracked.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** A runtime path spelled in segments so the move codemod never rewrites a fixture. */
const old = (...segments) => segments.join('/');
const MANIFEST = loadSlotManifest({ root: ROOT, file: path.join(ROOT, RUNTIME_MANIFEST_FILE) });
const RESOLVER = createSlotResolver(MANIFEST, resolveRepoDeclaration(MANIFEST, { hfs: 1, kind: 'runtime', project: 'starci' }));
const PARAMS = ruleParams(MANIFEST, 'runtime');
const codesOf = (findings) => findings.map((f) => f.code);

/** A ctx of the runtime rules over synthetic sources ({path: text}) judged by the real runtime manifest. */
const ctxOf = (sources, extra = {}) => {
  const list = Object.entries(sources).map(([p, text]) => ({ path: p, text }));
  const parsed = new Map(list.map((s) => [s.path, parseSource(s.text, s.path)]));
  const files = [...list.map((s) => s.path), ...(extra.files ?? [])];
  return { resolver: RESOLVER, params: PARAMS, sources: list, parsed: (p) => parsed.get(p), files, fileSet: new Set(files), sourceSet: new Set(list.map((s) => s.path)), base: null, read: (p) => sources[p] ?? null, ...extra };
};

// ------------------------------------------------------------------------------------------- RT_EXTERNAL_OWNER

const CP = ['node', 'child_process'].join(':');
const external = (file, text) => fileExternalFindings({ path: file, text, source: parseSource(text, file), owner: ownerIdOf(RESOLVER, file), infraOwners: PARAMS.infraOwners });

test('RT_EXTERNAL_OWNER: a domain module that imports child_process and spawns git is refused, with every call named', () => {
  const found = external('scripts/kernel/x.mjs', `import { spawnSync } from '${CP}';\nspawnSync('git', ['status']);\n`);
  assert.deepEqual(codesOf(found), ['RT_EXTERNAL_OWNER', 'RT_EXTERNAL_OWNER']);
  assert.match(found[1].message, /starts git; only api\/git may/);
  const viaFetch = external('scripts/supervisor/poll-x.mjs', 'export const read = (u) => fetch(u);\n');
  assert.deepEqual(codesOf(viaFetch), ['RT_EXTERNAL_OWNER'], 'the fetch global outside an http-speaking api system');
});

test('RT_EXTERNAL_OWNER: an api system spawning its own program, or a local fetch binding, is clean', () => {
  assert.equal(ownerIdOf(RESOLVER, 'scripts/api/git/show.mjs'), 'api/git');
  assert.deepEqual(external('scripts/api/git/x-run.mjs', `import { spawnSync } from '${CP}';\nexport const xRun = () => spawnSync('git', ['status']);\n`), []);
  assert.deepEqual(external('scripts/kernel/y.mjs', 'const fetch = (u) => u;\nexport const y = () => fetch(1);\n'), [], 'a local binding named fetch is not the global');
  const cross = external('scripts/api/orca/z-run.mjs', `import { spawnSync } from '${CP}';\nexport const zRun = () => spawnSync('git', ['log']);\n`);
  assert.deepEqual(codesOf(cross), ['RT_EXTERNAL_OWNER'], 'another system\'s program inside api/orca is still refused');
});

// ------------------------------------------------------------------------------------------- RT_TIER_DIRECTION / ARCH_OWNER_CYCLE

test('RT_TIER_DIRECTION and ARCH_OWNER_CYCLE: lib importing the kernel, and two domain owners importing each other, are refused', () => {
  const found = tierFindings(ctxOf({
    'scripts/lib/a.mjs': "import '../kernel/b.mjs';\n",
    'scripts/kernel/b.mjs': 'export const b = 1;\n',
    'scripts/agent/c.mjs': "import '../route/d.mjs';\n",
    'scripts/route/d.mjs': "import '../agent/c.mjs';\n",
  }));
  assert.deepEqual(codesOf(found).sort(), ['ARCH_OWNER_CYCLE', 'RT_TIER_DIRECTION']);
  assert.equal(found.find((f) => f.code === 'RT_TIER_DIRECTION').path, 'scripts/lib/a.mjs');
});

test('RT_TIER_DIRECTION and ARCH_OWNER_CYCLE: the kernel importing lib and api, and a one-way domain edge, are clean', () => {
  assert.deepEqual(tierFindings(ctxOf({
    'scripts/kernel/b.mjs': "import '../lib/a.mjs';\nimport '../api/git/show.mjs';\n",
    'scripts/lib/a.mjs': 'export const a = 1;\n',
    'scripts/api/git/show.mjs': "import '../../lib/a.mjs';\n",
    'scripts/agent/c.mjs': "import '../route/d.mjs';\n",
    'scripts/route/d.mjs': 'export const d = 1;\n',
  })), []);
});

// ------------------------------------------------------------------------------------------- RT_BASE_IMPURE

const base = (file, text, envSeam = false) => fileBaseFindings({ path: file, source: parseSource(text, file), writeMembers: PARAMS.baseWriteMembers, envSeam });

test('RT_BASE_IMPURE: a base helper writing a file or reading process.env outside a seam is refused', () => {
  assert.deepEqual(codesOf(base('scripts/lib/w.mjs', "import fs from 'node:fs';\nexport const w = (p) => fs.writeFileSync(p, 'x');\n")), ['RT_BASE_IMPURE']);
  assert.deepEqual(codesOf(base('scripts/lib/m.mjs', "import { mkdirSync as md } from 'node:fs';\nexport const m = (p) => md(p);\n")), ['RT_BASE_IMPURE'], 'an aliased named import still writes');
  assert.deepEqual(codesOf(base('scripts/lib/p.mjs', "import fs from 'node:fs';\nexport const p = (x) => fs.promises.rm(x);\n")), ['RT_BASE_IMPURE']);
  assert.deepEqual(codesOf(base('scripts/lib/e.mjs', 'export const e = () => process.env.HOME;\n')), ['RT_BASE_IMPURE']);
});

test('RT_BASE_IMPURE: reads, a local write-named function and an env read in a declared seam are clean', () => {
  assert.deepEqual(base('scripts/lib/r.mjs', "import fs from 'node:fs';\nexport const r = (p) => fs.readFileSync(p, 'utf8');\nconst writeFileSync = (x) => x;\nwriteFileSync(1);\n"), []);
  assert.deepEqual(base('scripts/lib/sleep-sync.mjs', 'export const scale = () => Number(process.env.STARCI_SLEEP_SCALE ?? 1);\n', true), []);
});

test('the secrets foundation owns its declared read-only environment seam', () => {
  const file = 'engine/secrets.mjs';
  assert.equal(RESOLVER.classifyPath(file).slot, 'runtime.foundation');
  assert.equal(RESOLVER.tierOf(file), 'base');
  assert.ok(PARAMS.baseEnvSeams.includes(file));
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert.deepEqual(base(file, text, PARAMS.baseEnvSeams.includes(file)), []);
  const write = base(file, "import fs from 'node:fs'; fs.writeFileSync('x', 'x');", true);
  assert.deepEqual(codesOf(write), ['RT_BASE_IMPURE'], 'the environment seam never permits filesystem writes');
});

// ------------------------------------------------------------------------------------------- RT_API_SHAPE

test('RT_API_SHAPE: a call file exporting a constant beside its call, or no call named after the file, is refused', () => {
  const two = callExportFinding('scripts/api/orca/worker-list.mjs', parseSource('export const PAGE = 1;\nexport function workerList() {}\n'));
  assert.equal(two.code, 'RT_API_SHAPE');
  const misnamed = callExportFinding('scripts/api/git/worktree-add.mjs', parseSource('export function createScratchWorktree() {}\n'));
  assert.equal(misnamed.code, 'RT_API_SHAPE');
  assert.match(misnamed.message, /worktreeAdd/);
});

test('RT_API_SHAPE: one exported call named after its file, and a contract id per call file, are clean', () => {
  assert.equal(callFunctionName('worker-start'), 'workerStart');
  assert.equal(callExportFinding('scripts/api/orca/worker-start.mjs', parseSource('export function workerStart() {}\n')), null);
  assert.equal(callExportFinding('scripts/api/git/show.mjs', parseSource('export const show = () => null;\n')), null);
  const ids = contractCallIds('schema: starci/orca-calls@1\ncalls:\n  worker-start:\n    command: orchestration worker-start\n');
  assert.ok(ids.has('worker-start') && !ids.has('worker-stop'));
});

// ------------------------------------------------------------------------------------------- RT_SPEC_PLACEMENT

test('RT_SPEC_PLACEMENT: a flat spec, a _ fixture, a package .test file and a spec under scripts/ are refused', () => {
  const packages = packageSlotsOf(MANIFEST);
  assert.equal(specPlacementFinding('tests/gone-slots.spec.mjs', 'runtime.tests', packages).code, 'RT_SPEC_PLACEMENT');
  assert.equal(specPlacementFinding('tests/_gone-fixture.mjs', 'runtime.tests', packages).code, 'RT_SPEC_PLACEMENT');
  assert.equal(specPlacementFinding('tests/helpers/x.spec.mjs', 'runtime.tests', packages).code, 'RT_SPEC_PLACEMENT', 'helpers is no source area');
  assert.equal(specPlacementFinding('packages/eslint/be/gone-cqrs.test.mjs', 'runtime.package', packages).code, 'RT_SPEC_PLACEMENT');
  assert.ok(packages.has('runtime.cli-source') && !packages.has('runtime.cli-generated'), 'the nested CLI source slot holds package source, its generated outputs do not');
  assert.equal(specPlacementFinding('packages/cli/src/package-entry.test.mjs', 'runtime.cli-source', packages).code, 'RT_SPEC_PLACEMENT', 'a .test. spec under packages/cli/src/ is refused');
  assert.equal(specPlacementFinding('scripts/kernel/x.spec.mjs', 'runtime.kernel', packages).code, 'RT_SPEC_PLACEMENT');
});

test('RT_SPEC_PLACEMENT: tests/<area>/<module>[.<topic>].spec.mjs, helpers, setup, fixtures and a package .spec are clean', () => {
  for (const p of ['tests/api-orca/worker-start.spec.mjs', 'tests/kernel-verbs/settle.retry.spec.mjs', 'tests/helpers/ledger-fixture.mjs', 'tests/setup/low-priority.mjs', 'tests/fixtures/any/thing.json'])
    assert.equal(specPlacementFinding(p, 'runtime.tests', packageSlotsOf(MANIFEST)), null, p);
  assert.equal(specPlacementFinding('packages/eslint/be/cqrs.spec.mjs', 'runtime.package', packageSlotsOf(MANIFEST)), null);
  assert.equal(specPlacementFinding('packages/cli/src/package-entry.spec.mjs', 'runtime.cli-source', packageSlotsOf(MANIFEST)), null);
});

// ------------------------------------------------------------------------------------------- RT_SOURCE_NAME

test('RT_SOURCE_NAME: one-off names, a non-kebab name and a basename repeated inside a tier are refused', () => {
  assert.deepEqual(codesOf(nameFindings('scripts/kernel/tmp-quota.mjs', PARAMS)), ['RT_SOURCE_NAME']);
  assert.deepEqual(codesOf(nameFindings(old('scripts', 'kernel', 'api-status', '_view.mjs'), PARAMS)), ['RT_SOURCE_NAME']);
  assert.deepEqual(codesOf(nameFindings('scripts/supervisor/owner-backfill.mjs', PARAMS)), ['RT_SOURCE_NAME']);
  assert.deepEqual(codesOf(nameFindings('scripts/kernel/camelCase.mjs', PARAMS)), ['RT_SOURCE_NAME']);
  const dup = sourceNameFindings(ctxOf({ 'scripts/agent/install.mjs': '', [old('scripts', 'guards', 'install.mjs')]: '' }));
  assert.deepEqual(codesOf(dup), ['RT_SOURCE_NAME', 'RT_SOURCE_NAME']);
});

test('RT_SOURCE_NAME: kebab names, and lib.mjs repeated across api systems, are clean', () => {
  assert.deepEqual(nameFindings('scripts/kernel/workflow-checkpoint.mjs', PARAMS), []);
  assert.deepEqual(sourceNameFindings(ctxOf({ 'scripts/api/git/lib.mjs': '', 'scripts/api/orca/lib.mjs': '', 'scripts/agent/send.mjs': '' })), []);
});

// ------------------------------------------------------------------------------------------- RT_PINNED_PATH_MOVED

const PINNED_FILES = ['packages/cli/bin/starci.mjs', 'scripts/kernel/cli.mjs', 'scripts/kernel/start-workflow.mjs', 'scripts/supervisor/start-supervisor.mjs', 'scripts/reconciler/boot.mjs', 'scripts/guards/command-guard.mjs', 'scripts/guards/seat-tools.mjs'];

test('RT_PINNED_PATH_MOVED: a pinned path that is gone is refused', () => {
  const gone = pinnedFindings(ctxOf({}, { files: PINNED_FILES.filter((p) => p !== 'packages/cli/bin/starci.mjs') }));
  assert.deepEqual(codesOf(gone), ['RT_PINNED_PATH_MOVED']);
});

test('RT_PINNED_PATH_MOVED: every pinned path present is clean', () => {
  assert.deepEqual(pinnedFindings(ctxOf({}, { files: PINNED_FILES })), []);
});

// ------------------------------------------------------------------------------------------- HFS_SIZE_GROWTH

const lines = (n) => `${Array.from({ length: n }, (_, i) => `export const v${i} = ${i};`).join('\n')}\n`;
const baseRev = (files, renames = {}) => ({ sha: '0123456789abcdef', show: (p) => files[p] ?? null, renamedFrom: (p) => renames[p] ?? null });

test('HFS_SIZE_GROWTH: an oversized runtime source that grows, or a new one above soft, is refused', () => {
  const grown = sizeFindings(ctxOf({ 'scripts/kernel/big.mjs': lines(620) }, { base: baseRev({ 'scripts/kernel/big.mjs': lines(600) }) }));
  assert.deepEqual(codesOf(grown), ['HFS_SIZE_GROWTH']);
  const fresh = sizeFindings(ctxOf({ 'scripts/kernel/new.mjs': lines(510) }, { base: baseRev({}) }));
  assert.deepEqual(codesOf(fresh), ['HFS_SIZE_GROWTH']);
});

test('HFS_SIZE_GROWTH: an oversized file that shrinks, a renamed one that keeps its size, and no base revision are clean', () => {
  assert.deepEqual(sizeFindings(ctxOf({ 'scripts/kernel/big.mjs': lines(590) }, { base: baseRev({ 'scripts/kernel/big.mjs': lines(600) }) })), []);
  assert.deepEqual(sizeFindings(ctxOf({ 'scripts/machine/decisions.mjs': lines(700) }, { base: baseRev({ [old('scripts', 'reconciler', 'decisions.mjs')]: lines(700) }, { 'scripts/machine/decisions.mjs': old('scripts', 'reconciler', 'decisions.mjs') }) })), []);
  assert.deepEqual(sizeFindings(ctxOf({ 'scripts/kernel/big.mjs': lines(900) })), []);
});

test('HFS_SIZE_GROWTH: a renamed oversized file that grows is refused against its old path', () => {
  const was = old('scripts', 'reconciler', 'decisions.mjs');
  const grown = sizeFindings(ctxOf({ 'scripts/machine/decisions.mjs': lines(720) }, { base: baseRev({ [was]: lines(700) }, { 'scripts/machine/decisions.mjs': was }) }));
  assert.deepEqual(codesOf(grown), ['HFS_SIZE_GROWTH']);
  assert.equal(grown[0].before, 701);
});

test('baseRevision: git rename detection maps a renamed file to its path at the merge-base with main', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-size-rename-'));
  try {
    const identity = { 'user.name': 'spec', 'user.email': 'spec@example.invalid', 'commit.gpgsign': 'false' };
    assert.equal(gitInit(dir).ok, true);
    fs.mkdirSync(path.join(dir, 'scripts', 'reconciler'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'scripts', 'reconciler', 'decisions.mjs'), lines(700));
    assert.equal(gitAdd(['-A'], { cwd: dir }).status, 0);
    assert.equal(gitCommit(['-m', 'base'], { cwd: dir, config: identity }).status, 0);
    fs.mkdirSync(path.join(dir, 'scripts', 'machine'), { recursive: true });
    fs.renameSync(path.join(dir, 'scripts', 'reconciler', 'decisions.mjs'), path.join(dir, 'scripts', 'machine', 'decisions.mjs'));
    assert.equal(gitAdd(['-A'], { cwd: dir }).status, 0);
    const base = baseRevision(dir);
    assert.equal(base.renamedFrom('scripts/machine/decisions.mjs'), 'scripts/reconciler/decisions.mjs');
    assert.equal(base.renamedFrom('scripts/machine/other.mjs'), null);
    assert.equal(base.show('scripts/reconciler/decisions.mjs'), lines(700));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ------------------------------------------------------------------------------------------- RT_NODE_MODULES_LINK

const links = (file, text) => fileLinkFindings({ path: file, text, source: parseSource(text, file) });

test('RT_NODE_MODULES_LINK: a junction or symlink made for node_modules, directly, through a wrapper or a spawned command, is refused', () => {
  assert.deepEqual(codesOf(links('scripts/supervisor/a.mjs', "import fs from 'node:fs';\nimport path from 'node:path';\nexport const a = (root, dir) => fs.symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'junction');\n")), ['RT_NODE_MODULES_LINK']);
  assert.deepEqual(codesOf(links('scripts/supervisor/b.mjs', "import { symlinkSync } from 'node:fs';\nconst link = (t, l) => symlinkSync(t, l, 'junction');\nconst NM = 'node_modules';\nexport const b = (r, d) => link(`${r}/${NM}`, `${d}/${NM}`);\n")), ['RT_NODE_MODULES_LINK'], 'a local wrapper and a const are followed');
  assert.deepEqual(codesOf(links('scripts/supervisor/c.mjs', `import { spawnSync } from '${CP}';\nexport const c = (d, s) => spawnSync('cmd', ['/c', 'mklink', '/J', \`\${d}/node_modules\`, s]);\n`)), ['RT_NODE_MODULES_LINK']);
  assert.deepEqual(codesOf(links('scripts/supervisor/d.mjs', `import { spawnSync } from '${CP}';\nexport const d = (p, s) => spawnSync('powershell', ['-Command', \`New-Item -ItemType Junction -Path \${p}/node_modules -Target \${s}\`]);\n`)), ['RT_NODE_MODULES_LINK']);
});

test('RT_NODE_MODULES_LINK: removing or detecting a node_modules link, and linking another directory, are clean', () => {
  assert.deepEqual(links('scripts/supervisor/e.mjs', "import fs from 'node:fs';\nimport path from 'node:path';\nexport const e = (dir) => { const nm = path.join(dir, 'node_modules'); if (fs.lstatSync(nm).isSymbolicLink()) fs.unlinkSync(nm); };\n"), []);
  assert.deepEqual(links('scripts/supervisor/f.mjs', "import fs from 'node:fs';\nexport const f = (t, l) => fs.symlinkSync(t, l, 'junction');\nexport const g = (r, w) => f(`${r}/.husky/_`, `${w}/.husky/_`);\nexport const n = 'node_modules';\n"), []);
});

// ------------------------------------------------------------------------------------------- RT_CONTROL_CHARACTER

test('RT_CONTROL_CHARACTER: a raw backspace, NUL or DEL in tracked text source is refused', () => {
  const backspace = controlCharFinding('tests/x.spec.mjs', Buffer.from([0x2f, 0x08, 0x61, 0x2f, 0x0a]));
  assert.equal(backspace.code, 'RT_CONTROL_CHARACTER');
  assert.match(backspace.message, /U\+0008/);
  assert.equal(controlCharFinding('scripts/x.mjs', Buffer.from('a\nb\u0000c')).line, 2);
  assert.equal(controlCharFinding('a.md', Buffer.from([0x7f])).code, 'RT_CONTROL_CHARACTER');
});

test('RT_CONTROL_CHARACTER: tab, CR, LF and an escaped \\b are clean', () => {
  assert.equal(controlCharFinding('scripts/x.mjs', Buffer.from('const r = /\\bx\\b/;\r\n\tok\n')), null);
});

// ------------------------------------------------------------------------------------------- RT_ABSOLUTE_PATH

// The fixtures below build their drive letters from parts: this spec is itself tracked and judged by the rule.
const DR = 'D';
const CR = 'C';
const BS = String.fromCharCode(92);
const abs = (file, text) => absolutePathFindings(file, text);

test('RT_ABSOLUTE_PATH: a drive literal in a .mjs string, a template, a comment or a spec fixture is refused', () => {
  assert.deepEqual(codesOf(abs('scripts/a.mjs', `export const root = '${DR}:/Repositories/x';\n`)), ['RT_ABSOLUTE_PATH']);
  assert.deepEqual(codesOf(abs('scripts/b.mjs', `export const p = (n) => \`${CR}:${BS}${BS}Users${BS}${BS}Hi${BS}${BS}\${n}\`;\n`)), ['RT_ABSOLUTE_PATH']);
  assert.deepEqual(codesOf(abs('scripts/c.mjs', `// lanes live under ${DR}:/starci-lanes\nexport const c = 1;\n`)), ['RT_ABSOLUTE_PATH']);
  assert.deepEqual(codesOf(abs('tests/x.spec.mjs', `test('x', () => { const prompt = 'PS ${CR}:${BS}${BS}work> '; });\n`)), ['RT_ABSOLUTE_PATH']);
  assert.equal(abs('scripts/a.mjs', `\n\nexport const root = '${DR}:/x';\n`)[0].line, 3);
  assert.deepEqual(codesOf(abs('packages/x/a.ts', `const p: string = '${DR}:/x';\n`)), ['RT_ABSOLUTE_PATH']);
});

test('RT_ABSOLUTE_PATH: a drive path in a yaml value, a json value or a doc line is refused', () => {
  assert.deepEqual(codesOf(abs('knowledge/x.yaml', `root: ${DR}:/starci-tmp/x\n`)), ['RT_ABSOLUTE_PATH']);
  assert.deepEqual(codesOf(abs('examples/e.json', `{"cwd": "${CR}:${BS}${BS}Users${BS}${BS}Hi"}\n`)), ['RT_ABSOLUTE_PATH']);
  const doc = abs('docs/x.md', `# x\n\nRun it from ${DR}:/Repositories/x.\n`);
  assert.deepEqual(codesOf(doc), ['RT_ABSOLUTE_PATH']);
  assert.equal(doc[0].line, 3);
});

test('RT_ABSOLUTE_PATH: a user-profile path and an expanded AppData path are refused, once per path', () => {
  assert.deepEqual(codesOf(abs('docs/a.md', ['', 'Users', 'someone', 'work', 'x'].join('/'))), ['RT_ABSOLUTE_PATH']);
  assert.deepEqual(codesOf(abs('docs/b.md', ['', 'home', 'someone', 'work', 'x'].join('/'))), ['RT_ABSOLUTE_PATH']);
  assert.deepEqual(codesOf(abs('docs/c.md', `under ${['AppData', 'Local', 'starci'].join('/')}`)), ['RT_ABSOLUTE_PATH']);
  assert.equal(abs('docs/d.md', [`${CR}:`, 'Users', 'someone', 'AppData', 'Local', 'x'].join('/')).length, 1, 'the profile and AppData parts of a drive path are one finding');
});

test('RT_ABSOLUTE_PATH: a URL, a generic drive regular expression, a relative path, an unexpanded name are clean', () => {
  assert.deepEqual(abs('scripts/a.mjs', "export const u = 'http://localhost:3000/x';\nexport const f = 'file:///tmp/x';\nexport const h = 'https://example.com/a';\n"), []);
  assert.deepEqual(abs('scripts/b.mjs', "export const isDrive = (p) => /^[A-Za-z]:[\\/]/.test(p);\nexport const rx = new RegExp('^[a-z]:[\\\\/]');\n"), []);
  assert.deepEqual(abs('docs/c.md', 'Set %LOCALAPPDATA% to the state root; use <runtime>/scripts and <lanes root>/dv.\n'), []);
  assert.deepEqual(abs('docs/d.md', 'key: value\nnote: a:b and 12:30 and e.g. ratio 1:2\n'), []);
  assert.deepEqual(abs('package-lock.json', `{"resolved": "${DR}:/x"}\n`), [], 'a lock file is not judged');
  assert.deepEqual(abs('scripts/goal.mjs', "// Goal Grüße:\\n\\nnull\nexport const goal = 'Goal Grüße:\\n';\n"), [], 'a letter that ends a non-ASCII word is not a drive');
  assert.deepEqual(abs('assets/x.png', `${DR}:/x`), [], 'a binary extension is not read');
});

test('RT_ABSOLUTE_PATH: a path built from os.tmpdir() or the runtime root is clean', () => {
  assert.deepEqual(abs('tests/y.spec.mjs', "import os from 'node:os';\nimport path from 'node:path';\nconst tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-'));\nconst prompt = `PS ${tmp}> `;\nconst repo = path.join(tmp, 'repo');\n"), []);
});

test('RT_ABSOLUTE_PATH: the repo scan reads tracked files through ctx.read', () => {
  const texts = { 'scripts/a.mjs': `export const a = '${DR}:/x';\n`, 'scripts/b.mjs': "export const b = 'ok';\n" };
  const found = absolutePathRepoFindings({ files: Object.keys(texts), read: (p) => texts[p] ?? null });
  assert.deepEqual(found.map((f) => f.path), ['scripts/a.mjs']);
});

// ------------------------------------------------------------------------------------------- the whole check on a fixture tree

const FIXTURE_MANIFEST = `schema: starci/runtime-slots@1
kind: runtime
version: 1.0.0
versioning: {patch: p, minor: m, major: M, pins: none}
presenceValues: [required, optional, opt-in, forbidden]
trackedValues: [tracked, ignored, external, generated]
testValues: [unit-beside, e2e, none]
profiles: [runtime]
tiers:
  runtime:
    kernel: {mayImport: [api, base]}
    api: {mayImport: [base]}
    base: {mayImport: [base], acyclic: true}
ruleParams:
  runtime:
    fileLines: {soft: 500, hardGrowth: true}
    sourceRoots: [scripts]
    infraOwners:
      modules: {"node:child_process": [api/*]}
      globals: {fetch: []}
      programs: {git: [api/git]}
    baseWriteMembers: [writeFileSync]
    baseEnvSeams: []
    apiContracts: {}
    sourceName: "^[a-z0-9]+(-[a-z0-9]+)*$"
    oneOffNames: ["tmp-*"]
    sharedBasenames: [lib.mjs]
    heldSecrets: []
    generated: [{root: packages/x/runtime, generatedBy: scripts/kernel/sync.mjs}]
    pinned: [{path: scripts/kernel/cli.mjs, why: the fixture's pinned entry}]
    selfChecks: [{id: none, run: scripts/kernel/cli.mjs}]
slots:
  - {id: runtime.declaration, profiles: [runtime], path: hfs.json, presence: required, tracked: tracked, tier: none, tests: none, coverage: none}
  - {id: runtime.manifest, profiles: [runtime], path: knowledge/hfs/runtime-slots.yaml, presence: required, tracked: tracked, tier: none, tests: none, coverage: none}
  - {id: runtime.kernel, profiles: [runtime], path: scripts/kernel/, presence: required, tracked: tracked, tier: kernel, owner: true, tests: none, coverage: none}
  - {id: runtime.lib, profiles: [runtime], path: "scripts/lib/<name>.mjs", presence: optional, tracked: tracked, tier: base, tests: none, coverage: none}
  - {id: runtime.generated-copy, profiles: [runtime], path: "packages/x/runtime/", presence: optional, tracked: generated, generatedBy: scripts/kernel/sync.mjs, tier: none, tests: none}
`;

/** A runtime fixture repository: hfs.json, the fixture manifest, and `files`. */
const fixture = (t, files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-runtime-hfs-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const all = { 'hfs.json': '{"hfs": 1, "kind": "runtime", "project": "fixture"}\n', [RUNTIME_MANIFEST_FILE]: FIXTURE_MANIFEST, 'scripts/kernel/cli.mjs': 'export const api = 1;\n', ...files };
  for (const [rel, body] of Object.entries(all)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), body); }
  // RT_FACT_FALSE reads the facts file from the judged repo; the fixture has no fact, and the file is not one of its tracked paths.
  fs.mkdirSync(path.join(dir, 'knowledge', 'hfs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'knowledge', 'hfs', 'facts.yaml'), 'schema: starci/facts@1\nfacts: []\n');
  return { dir, files: Object.keys(all) };
};
const check = (fx, options = {}) => runtimeCheck({ repoRoot: fx.dir, root: ROOT, files: fx.files, tree: false, base: null, drift: [], ...options });

test('runtimeCheck: a clean fixture tree is ok with no finding', (t) => {
  const r = check(fixture(t, { 'scripts/lib/clip.mjs': 'export const clip = (s) => s;\n' }));
  assert.equal(r.ok, true, JSON.stringify(r.findings));
  assert.deepEqual(r.findings, []);
});

test('RT_GENERATED_DRIFT: a generated copy that differs from its generator fails the check', (t) => {
  const r = check(fixture(t, {}), { drift: ['stale packages/x/runtime/a.mjs'] });
  assert.equal(r.ok, false);
  assert.deepEqual(codesOf(r.findings), ['RT_GENERATED_DRIFT']);
  assert.equal(r.findings[0].path, 'packages/x/runtime/a.mjs');
});

test('RT_GENERATED_DRIFT: copies that equal their generator give no finding', (t) => {
  assert.deepEqual(codesOf(check(fixture(t, {}), { drift: [] }).findings), []);
});

test('GENERATED_UNTRACKED: a tracked file under a generated root fails the check', (t) => {
  const r = check(fixture(t, { 'packages/x/runtime/copy.mjs': 'export const c = 1;\n' }));
  assert.equal(r.ok, false);
  assert.deepEqual(codesOf(r.findings), ['GENERATED_UNTRACKED']);
  assert.equal(r.findings[0].path, 'packages/x/runtime/copy.mjs');
});

test('GENERATED_UNTRACKED: a generated copy on disk that git does not track gives no finding', (t) => {
  // The fixture's files list is the tracked set: an ignored copy exists on disk but not in it.
  const fx = fixture(t, {});
  fs.mkdirSync(path.join(fx.dir, 'packages', 'x', 'runtime'), { recursive: true });
  fs.writeFileSync(path.join(fx.dir, 'packages', 'x', 'runtime', 'copy.mjs'), 'export const c = 1;\n');
  assert.deepEqual(codesOf(check(fx).findings), []);
});

test('GENERATED_UNTRACKED: a tracked file beside the generated root gives no finding', (t) => {
  assert.deepEqual(generatedUntrackedFindings(ctxOf({}, { files: ['packages/x/runtime-other/file.mjs', 'packages/x/runtime'] })), []);
});

test('the runtime manifest has no allowlist block: a runtime finding is fixed, never allowed', () => {
  assert.equal(MANIFEST.pending, undefined, 'the pending mechanism is gone; exceptions live in modules/kernel/allowlist.yaml sections');
});

// ------------------------------------------------------------------------------------------- CI_UPLOAD_NOT_SILENT

const uploadWorkflow = ({ perms = '    permissions:\n      id-token: write\n', step = '' } = {}) => `name: ci\non: push\njobs:\n  ci:\n${perms}    steps:\n      - uses: actions/checkout@v4\n      - name: coverage upload\n        uses: codecov/codecov-action@v5\n${step || '        with:\n          use_oidc: true\n          fail_ci_if_error: true\n'}`;
const uploadFindings = (text, file = '.github/workflows/ci.yml') => ciUploadFindings(ctxOf({}, { files: [file], read: () => text }));

test('CI_UPLOAD_NOT_SILENT: an upload without OIDC, without fail_ci_if_error, with continue-on-error, gated on a secret or without id-token is refused', () => {
  assert.deepEqual(codesOf(uploadFindings(uploadWorkflow({ step: '        with:\n          token: ${{ secrets.CODECOV_TOKEN }}\n          fail_ci_if_error: true\n' }))), ['CI_UPLOAD_NOT_SILENT'], 'a token upload is skipped silently when the secret is absent');
  assert.match(uploadFindings(uploadWorkflow({ step: '        with:\n          use_oidc: true\n' }))[0].message, /fail_ci_if_error/);
  assert.match(uploadFindings(uploadWorkflow({ step: '        continue-on-error: true\n        with:\n          use_oidc: true\n          fail_ci_if_error: true\n' }))[0].message, /continue-on-error/);
  assert.match(uploadFindings(uploadWorkflow({ step: "        if: ${{ !cancelled() && env.CODECOV_TOKEN != '' }}\n        with:\n          use_oidc: true\n          fail_ci_if_error: true\n" }))[0].message, /gated on a secret/);
  assert.match(uploadFindings(uploadWorkflow({ perms: '    permissions:\n      contents: read\n' }))[0].message, /id-token: write/);
});

test('CI_UPLOAD_NOT_SILENT: an OIDC upload that fails the job, in a workflow or in a template with placeholders, is clean', () => {
  assert.deepEqual(uploadFindings(uploadWorkflow()), []);
  assert.deepEqual(uploadFindings(uploadWorkflow({ perms: '' }).replace('name: ci\n', 'name: ci\npermissions:\n  id-token: write\n')), [], 'a workflow-level grant counts');
  assert.deepEqual(uploadFindings(uploadWorkflow({ step: '        if: ${{ !cancelled() }}\n        with:\n          use_oidc: true\n          files: {{lcovReport}}\n          fail_ci_if_error: true\n' }).replace('name: ci', '{{header}}\nname: ci'), 'packages/hfs/templates/app/ci-workflows/github/workflows/ci.yml'), []);
  assert.deepEqual(uploadFindings('name: x\non: push\njobs:\n  a:\n    steps:\n      - run: echo codecov\n'), [], 'no upload step, nothing to judge');
  assert.deepEqual(ciUploadFindings(ctxOf({}, { files: ['tests/fixtures/ci.yml', 'docs/notes.yml'], read: () => uploadWorkflow({ perms: '' }) })), [], 'only workflow files are read');
});

test('CI_UPLOAD_NOT_SILENT: every workflow of this repository, its examples and the hfs templates uploads loudly', () => {
  const folders = ['.github/workflows', 'packages/hfs/templates/app/ci-workflows/github/workflows', ...fs.readdirSync(path.join(ROOT, 'examples')).map((app) => `examples/${app}/.github/workflows`)];
  const files = folders.filter((dir) => fs.existsSync(path.join(ROOT, dir))).flatMap((dir) => fs.readdirSync(path.join(ROOT, dir)).map((f) => `${dir}/${f}`));
  assert.ok(files.length >= 8, 'the root, example and template workflows are read');
  assert.deepEqual(ciUploadFindings(ctxOf({}, { files, read: (f) => fs.readFileSync(path.join(ROOT, f), 'utf8') })), []);
});

// ------------------------------------------------------------------------------------------- CI_TRIGGERS_RELEASE_ONLY

const triggers = (on, file = '.github/workflows/ci.yml') => workflowTriggerFindings({ path: file, text: `name: ci\non:\n${on}\njobs:\n  a:\n    steps:\n      - run: echo\n` });

test('CI_TRIGGERS_RELEASE_ONLY: a branch push, a pull_request, a schedule, a filtered or unfiltered push and a missing block are refused', () => {
  assert.deepEqual(codesOf(triggers('  push:\n  pull_request:')), ['CI_TRIGGERS_RELEASE_ONLY', 'CI_TRIGGERS_RELEASE_ONLY']);
  assert.deepEqual(codesOf(triggers('  push:\n    branches: [dev]')), ['CI_TRIGGERS_RELEASE_ONLY'], 'the runtime pushes on main only');
  assert.deepEqual(codesOf(triggers('  push:\n    branches: [main, dev]')), ['CI_TRIGGERS_RELEASE_ONLY']);
  assert.deepEqual(codesOf(triggers("  push:\n    branches: [main]\n    paths: ['src/**']")), ['CI_TRIGGERS_RELEASE_ONLY'], 'a path filter beside the branch filter');
  assert.deepEqual(codesOf(triggers('  pull_request:\n    branches: [main]')), ['CI_TRIGGERS_RELEASE_ONLY'], 'a pull request into main is no push');
  const template = 'packages/hfs/templates/app/ci-workflows/github/workflows/ci.yml';
  for (const file of [template, 'examples/lite-app/.github/workflows/ci.yml']) assert.match(triggers('  push:\n    branches: [main]', file)[0].message, /not allowed in an example or an app template/, file);
  assert.deepEqual(codesOf(triggers("  push:\n    branches: [main]\n    tags: ['v*']", template)), ['CI_TRIGGERS_RELEASE_ONLY'], 'an app template keeps the tag law');
  assert.deepEqual(codesOf(triggers("  push:\n    tags: ['v*']\n    paths: ['src/**']")), ['CI_TRIGGERS_RELEASE_ONLY'], 'a path filter beside the tag filter');
  assert.deepEqual(codesOf(triggers("  push:\n    tags: ['*']")), ['CI_TRIGGERS_RELEASE_ONLY'], 'every tag is not a release tag');
  assert.match(triggers('  schedule:\n    - cron: "0 3 * * *"')[0].message, /`schedule` is not allowed/);
  assert.deepEqual(codesOf(triggers('  workflow_call:')), ['CI_TRIGGERS_RELEASE_ONLY']);
  assert.deepEqual(codesOf(triggers('  push')), ['CI_TRIGGERS_RELEASE_ONLY'], 'the scalar form is a branch push');
  assert.deepEqual(codesOf(workflowTriggerFindings({ path: 'w.yml', text: 'name: x\njobs: {}\n' })), ['CI_TRIGGERS_RELEASE_ONLY'], 'no on block');
});

test('CI_TRIGGERS_RELEASE_ONLY: a release-tag push with workflow_dispatch (with inputs), a manual-only workflow and a template with placeholders are clean', () => {
  assert.deepEqual(triggers("  push:\n    tags: ['v*']\n  workflow_dispatch:\n    inputs:\n      layers:\n        type: string"), []);
  assert.deepEqual(triggers('  workflow_dispatch:'), []);
  assert.deepEqual(triggers("  push:\n    branches: [main]\n    tags: ['v*']\n  workflow_dispatch:"), [], 'the runtime pushes on main, on a release tag and by hand');
  assert.deepEqual(triggers('  push:\n    branches: [main]'), [], 'a push to main in the runtime workflows');
  assert.deepEqual(workflowTriggerFindings({ path: 'packages/hfs/templates/app/ci-workflows/github/workflows/ci.yml', text: "{{header}}\nname: ci\non:\n  push:\n    tags: ['v*']\n  workflow_dispatch:\njobs:\n  a:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: {{nodeMajor}}\n" }), []);
  assert.deepEqual(gitTriggerFindings(ctxOf({}, { files: ['tests/fixtures/w.yml', 'docs/notes.yml'], read: () => 'name: x\non: push\njobs: {}\n' })), [], 'only workflow files are read');
});

test('CI_TRIGGERS_RELEASE_ONLY: every workflow of this repository, its examples and the hfs templates starts only on a release tag, by hand or on main in the runtime workflows', () => {
  const folders = ['.github/workflows', 'packages/hfs/templates/app/ci-workflows/github/workflows', ...fs.readdirSync(path.join(ROOT, 'examples')).map((app) => `examples/${app}/.github/workflows`)];
  const files = folders.filter((dir) => fs.existsSync(path.join(ROOT, dir))).flatMap((dir) => fs.readdirSync(path.join(ROOT, dir)).map((f) => `${dir}/${f}`));
  assert.ok(files.length >= 8, 'the root, example and template workflows are read');
  assert.deepEqual(gitTriggerFindings(ctxOf({}, { files, read: (f) => fs.readFileSync(path.join(ROOT, f), 'utf8') })), []);
});

// ------------------------------------------------------------------------------------------- RELEASE_NOTES

const CHANGELOG = '# Changelog\n\n## [1.0.0-alpha.5] — in preparation\n\n- next\n\n## [1.0.0-alpha.4] — 2026-10-04\n\n- shipped (Added, Changed, Evidence)\n\n## [1.0.0-alpha.3] — 2026-09-30\n\n- older, PENDING(none)\n';

test('RELEASE_NOTES: a release tag with no section, or with TODO, PENDING, TBD or in-preparation left in it, is refused', () => {
  assert.deepEqual(codesOf(releaseNotesFindings({ tags: ['v1.0.0-alpha.9'], changelog: CHANGELOG })), ['RELEASE_NOTES']);
  assert.match(releaseNotesFindings({ tags: ['v1.0.0-alpha.9'], changelog: CHANGELOG })[0].message, /has no `## \[1.0.0-alpha.9\]` section/);
  assert.match(releaseNotesFindings({ tags: ['v1.0.0-alpha.5'], changelog: CHANGELOG })[0].message, /in preparation/);
  assert.match(releaseNotesFindings({ tags: ['v1.0.0-alpha.3'], changelog: CHANGELOG })[0].message, /PENDING/);
  assert.match(releaseNotesFindings({ tags: ['v1.0.0'], changelog: '## [1.0.0] — 2026\n\n- TBD(sha) and TODO\n' })[0].message, /TBD.*TODO|TODO.*TBD/);
});

test('RELEASE_NOTES: a finished section, a tag that is not a release tag and a HEAD with no tag are clean; the section is its own text only', () => {
  assert.deepEqual(releaseNotesFindings({ tags: ['v1.0.0-alpha.4'], changelog: CHANGELOG }), []);
  assert.deepEqual(releaseNotesFindings({ tags: ['preserve/old', 'pre-1.0.4-merge'], changelog: CHANGELOG }), [], 'not a release tag: not judged here (the release flow refuses to push it)');
  assert.equal(changelogSection(CHANGELOG, '1.0.0-alpha.4').body.includes('older'), false);
  assert.deepEqual(releaseNotesRepoFindings(ctxOf({}, { tagsAtHead: [], read: () => CHANGELOG })), []);
  assert.deepEqual(codesOf(releaseNotesRepoFindings(ctxOf({}, { tagsAtHead: ['v1.0.0-alpha.5'], read: () => CHANGELOG }))), ['RELEASE_NOTES']);
});

