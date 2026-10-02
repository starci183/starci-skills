// runtime-hfs-rules.spec.mjs - the runtime HFS check (scripts/hfs/runtime-check.mjs) and its rule modules
// (scripts/hfs/runtime-rules/*): for every runtime rule of knowledge/hfs/rules.yaml a violating case and a passing one,
// read from source texts and small fixture trees, plus the pending ratchet (stale, added, a moved file keeps its entry).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUNTIME_MANIFEST_FILE, createSlotResolver, loadSlotManifest, resolveRepoDeclaration, ruleParams } from '../../scripts/hfs/slots.mjs';
import { runtimeCheck } from '../../scripts/hfs/runtime-check.mjs';
import { parseSource } from '../../scripts/hfs/runtime-rules/source-ast.mjs';
import { fileExternalFindings, ownerIdOf } from '../../scripts/hfs/runtime-rules/external-owner.mjs';
import { fileBaseFindings } from '../../scripts/hfs/runtime-rules/base-pure.mjs';
import { callExportFinding, callFunctionName, contractCallIds } from '../../scripts/hfs/runtime-rules/api-shape.mjs';
import { specPlacementFinding } from '../../scripts/hfs/runtime-rules/test-layout.mjs';
import { nameFindings, sourceNameFindings } from '../../scripts/hfs/runtime-rules/source-name.mjs';
import { pinnedFindings, retiredFindings } from '../../scripts/hfs/runtime-rules/retired.mjs';
import { sizeFindings } from '../../scripts/hfs/runtime-rules/size.mjs';
import { tierFindings } from '../../scripts/hfs/runtime-rules/tier-direction.mjs';
import { applyPending, pendingMatcher } from '../../scripts/hfs/runtime-rules/pending.mjs';
import { fileLinkFindings } from '../../scripts/hfs/runtime-rules/node-modules-link.mjs';
import { controlCharFinding } from '../../scripts/hfs/runtime-rules/control-chars.mjs';
import { absolutePathFindings, absolutePathRepoFindings } from '../../scripts/hfs/runtime-rules/absolute-path.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** An old (moved or retired) runtime path, spelled in segments so the move codemod never rewrites a fixture. */
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
  return { resolver: RESOLVER, params: PARAMS, sources: list, parsed: (p) => parsed.get(p), files, fileSet: new Set(files), sourceSet: new Set(list.map((s) => s.path)), retiredPaths: {}, base: null, read: () => null, ...extra };
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
  assert.equal(specPlacementFinding('tests/hfs-slots.spec.mjs', 'runtime.tests').code, 'RT_SPEC_PLACEMENT');
  assert.equal(specPlacementFinding('tests/_ledger-fixture.mjs', 'runtime.tests').code, 'RT_SPEC_PLACEMENT');
  assert.equal(specPlacementFinding('tests/helpers/x.spec.mjs', 'runtime.tests').code, 'RT_SPEC_PLACEMENT', 'helpers is no source area');
  assert.equal(specPlacementFinding('packages/eslint/be/cqrs.test.mjs', 'runtime.package').code, 'RT_SPEC_PLACEMENT');
  assert.equal(specPlacementFinding('scripts/kernel/x.spec.mjs', 'runtime.kernel').code, 'RT_SPEC_PLACEMENT');
});

test('RT_SPEC_PLACEMENT: tests/<area>/<module>[.<topic>].spec.mjs, helpers, setup, fixtures and a package .spec are clean', () => {
  for (const p of ['tests/api-orca/worker-start.spec.mjs', 'tests/kernel-verbs/settle.retry.spec.mjs', 'tests/helpers/ledger-fixture.mjs', 'tests/setup/low-priority.mjs', 'tests/fixtures/any/thing.json'])
    assert.equal(specPlacementFinding(p, 'runtime.tests'), null, p);
  assert.equal(specPlacementFinding('packages/eslint/be/cqrs.spec.mjs', 'runtime.package'), null);
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

// ------------------------------------------------------------------------------------------- RT_RETIRED_PRESENT / RT_PINNED_PATH_MOVED

test('RT_RETIRED_PRESENT: a retired path, a moved-from path or a retired symbol that comes back is refused', () => {
  const ctx = ctxOf({ 'scripts/kernel/orca-tasks.mjs': 'export function closeOperationTask() {}\n' }, {
    files: ['scripts/lib/kill-tree.mjs', old('scripts', 'checks', 'gate.mjs')],
    retiredPaths: { retired: [{ path: 'scripts/lib/kill-tree.mjs' }], moved: [{ from: old('scripts', 'checks', 'gate.mjs'), to: 'scripts/gates/gate.mjs', movedIn: 'C4' }], retiredSymbols: [{ symbol: 'closeOperationTask', replacedBy: 'worker_done' }] },
  });
  assert.deepEqual(codesOf(retiredFindings(ctx)), ['RT_RETIRED_PRESENT', 'RT_RETIRED_PRESENT', 'RT_RETIRED_PRESENT']);
});

test('RT_RETIRED_PRESENT: retired paths that stay gone and a symbol only called, never declared, are clean', () => {
  const ctx = ctxOf({ 'scripts/kernel/orca-tasks.mjs': "import { other } from './x.mjs';\nother('closeOperationTask');\n" }, {
    retiredPaths: { retired: [{ path: 'scripts/lib/kill-tree.mjs' }], moved: [{ from: old('scripts', 'checks', 'gate.mjs'), to: 'scripts/gates/gate.mjs' }], retiredSymbols: [{ symbol: 'closeOperationTask', replacedBy: 'worker_done' }] },
  });
  assert.deepEqual(retiredFindings(ctx), []);
});

test('RT_RETIRED_PRESENT: a migration comment that names a retired symbol is a stale cite; the replacement and SQL code are clean', () => {
  const sql = {
    'engine/db/migrations/machine/0001-init.sql': 'CREATE TABLE t(x);\n-- removed by safeRemoveTree, never followed\n',
    'engine/db/migrations/runtime/0001-init.sql': "-- removed by safeRemove\nCREATE TABLE safeRemoveTree_log(x); INSERT INTO t VALUES('safeRemoveTree');\n",
  };
  const ctx = (files) => ctxOf({}, { files: Object.keys(files), read: (p) => files[p] ?? null, retiredPaths: { retiredSymbols: [{ symbol: 'safeRemoveTree', replacedBy: 'safeRemove' }] } });
  const found = retiredFindings(ctx(sql));
  assert.deepEqual(found.map((f) => [f.code, f.path, f.line]), [['RT_RETIRED_PRESENT', 'engine/db/migrations/machine/0001-init.sql', 2]]);
  assert.match(found[0].message, /names safeRemoveTree in a comment/);
  assert.deepEqual(retiredFindings(ctx({ 'engine/db/migrations/runtime/0001-init.sql': sql['engine/db/migrations/runtime/0001-init.sql'] })), []);
});

const PINNED_FILES = ['packages/cli/bin/starci.mjs', 'scripts/kernel/cli.mjs', 'scripts/kernel/start-workflow.mjs', 'scripts/supervisor/start-supervisor.mjs', 'scripts/reconciler/boot.mjs', 'scripts/guards/command-guard.mjs', 'scripts/guards/seat-tools.mjs'];

test('RT_PINNED_PATH_MOVED: a pinned path that is gone, or moved without quiesced: true, is refused', () => {
  const gone = pinnedFindings(ctxOf({}, { files: PINNED_FILES.filter((p) => p !== 'packages/cli/bin/starci.mjs') }));
  assert.deepEqual(codesOf(gone), ['RT_PINNED_PATH_MOVED']);
  const loose = pinnedFindings(ctxOf({}, { files: [...PINNED_FILES, 'scripts/api/orca/worker-go.mjs'], retiredPaths: { moved: [{ from: 'scripts/api/orca/worker-start.mjs', to: 'scripts/api/orca/worker-go.mjs', quiesced: false }] } }));
  assert.deepEqual(codesOf(loose), ['RT_PINNED_PATH_MOVED'], 'a pinned pattern (scripts/api/orca/<call>.mjs) moves only quiesced');
});

test('RT_PINNED_PATH_MOVED: every pinned path present, or one moved with the fleet quiesced, is clean', () => {
  assert.deepEqual(pinnedFindings(ctxOf({}, { files: PINNED_FILES })), []);
  const moved = pinnedFindings(ctxOf({}, { files: [...PINNED_FILES.filter((p) => p !== 'packages/cli/bin/starci.mjs'), 'packages/cli/bin/starci-next.mjs'], retiredPaths: { moved: [{ from: 'packages/cli/bin/starci.mjs', to: 'packages/cli/bin/starci-next.mjs', quiesced: true }] } }));
  assert.deepEqual(moved, []);
});

// ------------------------------------------------------------------------------------------- HFS_SIZE_GROWTH

const lines = (n) => `${Array.from({ length: n }, (_, i) => `export const v${i} = ${i};`).join('\n')}\n`;
const baseRev = (files) => ({ sha: '0123456789abcdef', show: (p) => files[p] ?? null });

test('HFS_SIZE_GROWTH: an oversized runtime source that grows, or a new one above soft, is refused', () => {
  const grown = sizeFindings(ctxOf({ 'scripts/kernel/big.mjs': lines(620) }, { base: baseRev({ 'scripts/kernel/big.mjs': lines(600) }) }));
  assert.deepEqual(codesOf(grown), ['HFS_SIZE_GROWTH']);
  const fresh = sizeFindings(ctxOf({ 'scripts/kernel/new.mjs': lines(510) }, { base: baseRev({}) }));
  assert.deepEqual(codesOf(fresh), ['HFS_SIZE_GROWTH']);
});

test('HFS_SIZE_GROWTH: an oversized file that shrinks, a moved one that keeps its size, and no base revision are clean', () => {
  assert.deepEqual(sizeFindings(ctxOf({ 'scripts/kernel/big.mjs': lines(590) }, { base: baseRev({ 'scripts/kernel/big.mjs': lines(600) }) })), []);
  assert.deepEqual(sizeFindings(ctxOf({ 'scripts/machine/decisions.mjs': lines(700) }, { base: baseRev({ [old('scripts', 'reconciler', 'decisions.mjs')]: lines(700) }), retiredPaths: { moved: [{ from: old('scripts', 'reconciler', 'decisions.mjs'), to: 'scripts/machine/decisions.mjs' }] } })), []);
  assert.deepEqual(sizeFindings(ctxOf({ 'scripts/kernel/verbs/big.mjs': lines(700) }, { base: baseRev({ [old('scripts', 'kernel', 'api-verbs', 'big.mjs')]: lines(700) }), retiredPaths: { moved: [{ from: old('scripts', 'kernel', 'api-verbs', ''), to: 'scripts/kernel/verbs/' }] } })), [], 'a file below a moved directory keeps its size');
  assert.deepEqual(sizeFindings(ctxOf({ 'scripts/kernel/big.mjs': lines(900) })), []);
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

test('RT_ABSOLUTE_PATH: a real path-parsing vector is allowed only by a pending entry with a reason', () => {
  const findings = absolutePathFindings('tests/path-parse.spec.mjs', `assert.equal(parse('${CR}:${BS}${BS}x'), 1);\n`);
  assert.deepEqual(codesOf(findings), ['RT_ABSOLUTE_PATH']);
  const pending = [{ path: 'tests/path-parse.spec.mjs', rule: 'RT_ABSOLUTE_PATH', lane: 'ABSPATH', since: '2026-10-02', reason: 'feeds the Windows path parser its drive input' }];
  const judged = applyPending({ findings, pending, basePending: pending, codes: new Set(['RT_ABSOLUTE_PATH']) });
  assert.deepEqual(judged.errors, []);
  assert.equal(judged.allowed[0].level, 'pending');
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
versioning: {patch: p, minor: m, major: M, retire: r, pins: none}
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
    generated: [{root: packages/x/runtime, generatedBy: scripts/kernel/sync.mjs}]
    pinned: [{path: scripts/kernel/cli.mjs, why: the fixture's pinned entry}]
    selfChecks: [{id: none, run: scripts/kernel/cli.mjs}]
slots:
  - {id: runtime.declaration, profiles: [runtime], path: hfs.json, presence: required, tracked: tracked, tier: none, tests: none}
  - {id: runtime.manifest, profiles: [runtime], path: knowledge/hfs/runtime-slots.yaml, presence: required, tracked: tracked, tier: none, tests: none}
  - {id: runtime.kernel, profiles: [runtime], path: scripts/kernel/, presence: required, tracked: tracked, tier: kernel, owner: true, tests: none}
  - {id: runtime.lib, profiles: [runtime], path: "scripts/lib/<name>.mjs", presence: optional, tracked: tracked, tier: base, tests: none}
`;

/** A runtime fixture repository: hfs.json, the fixture manifest (with `pending`), and `files`. */
const fixture = (t, files, pending = []) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-runtime-hfs-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const pendingText = `pending:\n${pending.map((e) => `  - {path: "${e.path}", rule: ${e.rule}, lane: ${e.lane ?? 'C2a'}, since: 2026-10-01, reason: fixture}`).join('\n')}\n`;
  const all = { 'hfs.json': '{"hfs": 1, "kind": "runtime", "project": "fixture"}\n', [RUNTIME_MANIFEST_FILE]: `${FIXTURE_MANIFEST}${pending.length ? pendingText : 'pending: []\n'}`, 'scripts/kernel/cli.mjs': 'export const api = 1;\n', ...files };
  for (const [rel, body] of Object.entries(all)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), body); }
  // RT_FACT_FALSE reads the facts file from the judged repo; the fixture has no fact, and the file is not one of its tracked paths.
  fs.mkdirSync(path.join(dir, 'knowledge', 'hfs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'knowledge', 'hfs', 'facts.yaml'), 'schema: starci/facts@1\nfacts: []\n');
  return { dir, files: Object.keys(all) };
};
const check = (fx, options = {}) => runtimeCheck({ repoRoot: fx.dir, root: ROOT, files: fx.files, tree: false, base: null, drift: [], ...options });
const SPAWNING_LIB = { 'scripts/lib/run.mjs': `import { spawnSync } from '${CP}';\nexport const run = () => spawnSync('git', ['status']);\n` };
const manifestWith = (pending) => `${FIXTURE_MANIFEST}pending:\n${pending.map((e) => `  - {path: "${e.path}", rule: ${e.rule}, lane: C2a, since: 2026-10-01, reason: base}`).join('\n')}\n`;

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

test('pending: a finding its entry names reports at level pending and never fails', (t) => {
  const r = check(fixture(t, SPAWNING_LIB, [{ path: 'scripts/lib/run.mjs', rule: 'RT_EXTERNAL_OWNER' }]));
  assert.equal(r.ok, true, JSON.stringify(r.findings));
  assert.ok(r.pending.length >= 2 && r.pending.every((f) => f.code === 'RT_EXTERNAL_OWNER' && f.level === 'pending' && f.lane === 'C2a'));
});

test('RT_PENDING_STALE: an entry that allows no finding fails the check', (t) => {
  const r = check(fixture(t, { 'scripts/lib/clip.mjs': 'export const clip = (s) => s;\n' }, [{ path: 'scripts/lib/clip.mjs', rule: 'RT_EXTERNAL_OWNER' }]));
  assert.equal(r.ok, false);
  assert.deepEqual(codesOf(r.findings), ['RT_PENDING_STALE']);
  const unknown = check(fixture(t, SPAWNING_LIB, [{ path: 'scripts/lib/run.mjs', rule: 'RT_EXTERNAL_OWNER' }, { path: 'scripts/lib/run.mjs', rule: 'NOT_A_RUNTIME_CODE' }]));
  assert.deepEqual(codesOf(unknown.findings), ['RT_PENDING_STALE'], 'a code no runtime rule reports is stale');
});

test('RT_PENDING_ADDED: adding an entry the base revision did not have fails the check; the list only shrinks', (t) => {
  const fx = fixture(t, SPAWNING_LIB, [{ path: 'scripts/lib/run.mjs', rule: 'RT_EXTERNAL_OWNER' }]);
  const r = check(fx, { base: baseRev({ [RUNTIME_MANIFEST_FILE]: manifestWith([]) }) });
  assert.equal(r.ok, false);
  assert.deepEqual(codesOf(r.findings), ['RT_PENDING_ADDED']);
  const widened = check(fx, { base: baseRev({ [RUNTIME_MANIFEST_FILE]: manifestWith([{ path: 'scripts/lib/other.mjs', rule: 'RT_EXTERNAL_OWNER' }]) }) });
  assert.deepEqual(codesOf(widened.findings), ['RT_PENDING_ADDED'], 'retargeting an entry to a new path is an addition');
});

test('RT_PENDING_ADDED: an entry the base had, a narrowed one, and one that follows a moved file are clean', (t) => {
  const fx = fixture(t, SPAWNING_LIB, [{ path: 'scripts/lib/run.mjs', rule: 'RT_EXTERNAL_OWNER' }]);
  assert.deepEqual(check(fx, { base: baseRev({ [RUNTIME_MANIFEST_FILE]: manifestWith([{ path: 'scripts/lib/run.mjs', rule: 'RT_EXTERNAL_OWNER' }]) }) }).findings, []);
  assert.deepEqual(check(fx, { base: baseRev({ [RUNTIME_MANIFEST_FILE]: manifestWith([{ path: 'scripts/lib/{run,walk}.mjs', rule: 'RT_EXTERNAL_OWNER' }]) }) }).findings, [], 'a narrowed brace list allows a subset');
  const moved = fixture(t, { ...SPAWNING_LIB, 'modules/kernel/retired-paths.yaml': 'schema: starci/retired-paths@2\nretired: []\nmoved:\n  - {from: scripts/kernel/run.mjs, to: scripts/lib/run.mjs, movedIn: C3, quiesced: false}\nretiredSymbols: []\n' }, [{ path: 'scripts/lib/run.mjs', rule: 'RT_EXTERNAL_OWNER' }]);
  const r = check(moved, { base: baseRev({ [RUNTIME_MANIFEST_FILE]: manifestWith([{ path: 'scripts/kernel/run.mjs', rule: 'RT_EXTERNAL_OWNER' }]) }) });
  assert.deepEqual(codesOf(r.findings).filter((c) => c.startsWith('RT_PENDING')), [], 'a moved file keeps its allowance through moved[]');
});

test('applyPending: matching is by code and path glob, a trailing / covers a directory', () => {
  assert.ok(pendingMatcher(old('scripts', 'kernel', 'api-verbs', ''))(old('scripts', 'kernel', 'api-verbs', 'x.mjs')));
  assert.ok(pendingMatcher('tests/*.spec.mjs')('tests/a.spec.mjs') && !pendingMatcher('tests/*.spec.mjs')('tests/x/a.spec.mjs'));
  const { errors, allowed } = applyPending({ findings: [{ code: 'RT_SOURCE_NAME', level: 'error', path: 'scripts/a.mjs' }], pending: [{ path: 'scripts/a.mjs', rule: 'RT_API_SHAPE', lane: 'C6' }], codes: new Set(['RT_SOURCE_NAME', 'RT_API_SHAPE']) });
  assert.deepEqual(allowed, []);
  assert.deepEqual(errors.map((f) => f.code), ['RT_SOURCE_NAME', 'RT_PENDING_STALE'], 'an entry of another code allows nothing and is stale');
});

test('the runtime manifest: every cut landed, so the shrink-only pending allowlist is empty', () => {
  assert.deepEqual(MANIFEST.pending, [], 'a runtime finding is fixed, never allowlisted again');
});
