import fs from 'node:fs';
import path from 'node:path';
import { lsFiles } from '../../api/git/ls-files.mjs'; import { revParseQuery } from '../../api/git/rev-parse-query.mjs'; import { configGet } from '../../api/git/config-get.mjs'; import { gitOutputOf } from '../../lib/git.mjs';
import { braceVariants } from '../../lib/glob.mjs';
import { createSlotResolver, loadSlotManifest, openHfs } from '../slots.mjs';
import { isFeTestPath } from '../rules/fe-no-tests.mjs';
import { byCodeUnit } from '../../lib/list.mjs';
import { checkRepoPresentationImpl } from './presentation.mjs';
import { e2eInAutomaticGate, testTreesOutOfDefaultProgram } from './automatic-gates.mjs';
/**
 * HFS repository-tree check (knowledge/hfs/README.md): every StarCi repository is an
 * apps/<app>/ monorepo on npm with a fixed root-entry allowlist; backend composition lives in
 * apps/<app>/src and shared source under src/{features,modules,tests} with the three module tiers
 * domain/platform/integrations; frontend source lives only under apps/<app>/src. The judged tree is
 * the tracked one (`git ls-files` from the target root); a target outside a work tree falls back to
 * the filesystem view so fixtures and un-tracked checkouts are judged the same way.
 */

export const HFS_RULE_IDS = [
  'BE_TEST_TOPOLOGY',
  'HFS_APPS_REQUIRED',
  'HFS_APP_LAYOUT_INVALID',
  'HFS_E2E_IN_AUTOMATIC_GATE',
  'HFS_HOOKS_PATH_REDIRECTED',
  'HFS_MODULE_TIER_INVALID',
  'HFS_PACKAGE_MANAGER_MIXED',
  'HFS_README_BADGE_NOT_LIVE',
  'HFS_README_DESCRIPTION_INVALID',
  'HFS_README_DEVELOPMENT_INCOMPLETE',
  'HFS_README_PRIVATE_URL',
  'HFS_README_SECTION_MISSING',
  'HFS_README_SECTION_ORDER',
  'HFS_README_TITLE_INVALID',
  'HFS_README_WORK_POINTER_MISSING',
  'HFS_ROOT_ENTRY_FORBIDDEN',
  'HFS_ROOT_ENTRY_MISSING',
  'HFS_ROOT_MARKDOWN_FORBIDDEN',
  'HFS_ROOT_SRC_FORBIDDEN_FE',
  'HFS_SRC_LAYOUT_INVALID',
  'HFS_STACKS_IN_SIDE',
  'HFS_WORK_IN_FE',
];

const NON_NPM_ENTRIES = new Set(['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb']);
const HUSKY_HOOKS_PATH = /^\.husky(?:\/_)?\/?$/u;
const BACKEND_SRC_CHILDREN = new Set(['features', 'modules', 'tests']);
const moduleTiersOf = resolver => new Set(resolver.slots().filter(slot => slot.profiles.includes('be')).flatMap(slot => braceVariants(slot.path)).map(variant => /^src\/modules\/([a-z][a-z-]*)\//.exec(variant)?.[1]).filter(Boolean)); // the folders of src/modules/ the slot manifest knows (domain, platform, integrations, events, queues, projections)
// Owner test layout 2026-09-30: unit `<name>.spec.ts`, integration, e2e and contract by folder and suffix; int-spec and harness-spec stay banned.
const UNSUPPORTED_TEST_SUFFIX = /\.(?:int|harness)-spec\.[cm]?[jt]sx?$/u;
const UNSUPPORTED_TEST_FOLDER = /^src\/tests\/(?:harness|live|e2e\/live)(?:\/|$)/u;
const EXTRA_TEST_CONFIG = /(?:^|\/)(?:jest[.-][^/]*(?:config\.[cm]?[jt]s|\.json)|jest-(?:e2e|int|integration|harness)[^/]*)$/u;
const NODE_ENTRIES_SKIPPED = new Set(['node_modules', '.git']);

/** The slot resolver of a side folder: the caller's, else the side view its app's hfs.json declares, else the profile's slots with no app declared. */
function resolverOf(root, profile, given) {
  if (given) return given;
  try { return openHfs({ repoRoot: root }); } catch { /* an invalid hfs.json is HFS_DECLARATION_INVALID's finding, judged elsewhere */ }
  return createSlotResolver(loadSlotManifest(), { profile, side: profile, apps: [], optionalSlots: [], connections: [], reads: [] });
}

/**
 * The first path segment of every slot of the scope that may exist: the root entries of a side (contracts/, docs/, src/ ...) or of
 * the app (be/, fe/, .github/ ...). `scope` is the profile whose slots count (the app resolver answers for the sides too).
 */
function slotRootEntries(resolver, scope) {
  const roots = new Set(scope === 'app' ? [] : ['apps']);
  for (const slot of resolver.slots()) {
    if (slot.presence === 'forbidden' || !slot.profiles.includes(scope)) continue;
    for (const variant of braceVariants(slot.path)) {
      const first = variant.split('/')[0];
      if (first && !/[*?<%]/u.test(first)) roots.add(first);
    }
  }
  return roots;
}

/** The root entries the scope's required slots name (the first segment of every required path of the scope): hfs.json, be/, .starcistacks/ ... */
function requiredRootEntries(resolver) {
  return new Set(resolver.requiredPaths().paths.filter((entry) => !entry.side).map((entry) => entry.path.split('/')[0]));
}

/** The folders directly below src/tests/ that the be.tests.* slots declare (world, fixtures, integration, e2e, contract). */
function slotTestChildren(resolver) {
  const children = new Set();
  for (const slot of resolver.slots()) {
    for (const variant of braceVariants(slot.path)) {
      const match = /^src\/tests\/([^/*?<]+)\//u.exec(variant);
      if (match) children.add(match[1]);
    }
  }
  return children;
}

/**
 * Whether the given root is the top level of its own Git work tree. An example under a runtime clone is a directory of
 * that clone, not a work tree of its own: the clone's hooks and root are not the example's. A directory outside any work
 * tree is not a top level either.
 */
function ownsGitTopLevel(root) {
  try {
    const top = gitOutputOf(revParseQuery(['--show-toplevel'], { cwd: root }), 'git rev-parse --show-toplevel').trim();
    const same = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
    return same(fs.realpathSync(path.resolve(top)), fs.realpathSync(path.resolve(root)));
  } catch {
    return false;
  }
}

/** A directory that is not the top level of its own work tree has no hooks of its own: the check is not applicable there. */
function hooksPathNotRedirected({ root, finding }) {
  if (!ownsGitTopLevel(root)) return { status: 'not-applicable', reason: 'the checked root is not the top level of its own Git work tree, so it has no hooks of its own' };
  const set = configGet(root, 'core.hooksPath', { local: true });
  if (!set.ok) return { status: 'checked' }; // key not set: nothing is redirected
  const value = set.stdout;
  if (value && !HUSKY_HOOKS_PATH.test(value.replaceAll('\\', '/')))
    finding('HFS_HOOKS_PATH_REDIRECTED', '.git/config', `core.hooksPath is set to ${value} in this clone. Unset it (git config --local --unset core.hooksPath) and let husky own the hooks; a redirected path skips the pre-commit and pre-push gates.`);
  return { status: 'checked' };
}

/** The tracked paths under the given root, relative to it: the pathspec keeps a nested directory from listing the paths of its enclosing clone. */
function gitPaths(root) {
  try {
    // An empty index is still a Git tree. Falling back to disk in that case would count
    // untracked build output as repository content.
    gitOutputOf(revParseQuery(['--is-inside-work-tree'], { cwd: root }), 'git rev-parse --is-inside-work-tree');
    const out = gitOutputOf(lsFiles(['--cached', '-z', '--', '.'], { cwd: root, maxBuffer: 256 * 1024 * 1024 }), 'git ls-files');
    return out.split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

function fsHasDir(root, relative) {
  try { return fs.statSync(path.join(root, ...relative.split('/'))).isDirectory(); } catch { return false; }
}

function fsHasFile(root, relative) {
  try { return fs.statSync(path.join(root, ...relative.split('/'))).isFile(); } catch { return false; }
}

function fsChildren(root, relative) {
  try {
    return fs.readdirSync(path.join(root, ...relative.split('/')), { withFileTypes: true })
      .map(entry => entry.name);
  } catch {
    return [];
  }
}

function fsFiles(root, relative = '') {
  const out = [];
  for (const name of fsChildren(root, relative || '.')) {
    if (NODE_ENTRIES_SKIPPED.has(name)) continue;
    const child = relative ? `${relative}/${name}` : name;
    if (fsHasDir(root, child)) out.push(...fsFiles(root, child));
    else out.push(child);
  }
  return out;
}

/** The tree view of a list of tracked paths (posix, root-relative): what the git view answers, for a list already in hand. */
export function trackedTreeView(tracked) {
  const files = new Set(tracked);
  return {
    source: 'git',
    top: [...new Set(tracked.map(file => file.split('/')[0]))],
    children: dir => {
      const prefix = `${dir}/`;
      const names = new Set();
      for (const file of tracked) if (file.startsWith(prefix)) names.add(file.slice(prefix.length).split('/')[0]);
      return [...names];
    },
    hasDir: dir => tracked.some(file => file.startsWith(`${dir}/`)),
    hasFile: file => files.has(file),
    files: () => tracked,
  };
}

/** Uniform tree view: top entries plus children(dir)/hasDir/hasFile answers over posix relatives. */
function treeView(root) {
  const tracked = gitPaths(root);
  if (tracked !== null) return trackedTreeView(tracked);
  return {
    source: 'fs',
    top: fsChildren(root, '.'),
    children: dir => fsChildren(root, dir),
    hasDir: dir => fsHasDir(root, dir),
    hasFile: file => fsHasFile(root, file),
    files: () => fsFiles(root),
  };
}

/** Presentation checks shared by the product HFS gate and this runtime's own standalone gate. */
export function checkRepoPresentation({ root, runtime = false, tree = treeView(root), profile = 'app', edition = 'full' }) {
  return checkRepoPresentationImpl({ root, runtime, tree, profile, edition, nonNpmEntries: NON_NPM_ENTRIES });
}
function checkSideRootEntries(state) {
  const { tree, profile, frontend, backend, allowed, finding } = state;
  // The README, the hooks, the workflows and the scripts are the app root's (checkAppRoot); a side folder is judged as the old
  // repository root it stands for, less those.
  for (const entry of [...tree.top].sort(byCodeUnit)) {
    if (NON_NPM_ENTRIES.has(entry) || /\.md$/iu.test(entry)) continue;
    if (entry === '.starcistacks') { finding('HFS_STACKS_IN_SIDE', entry, `The ${profile} side must not hold .starcistacks; stack declarations and sealed custody live in the app root .starcistacks.`); continue; }
    if (frontend && !backend) {
      if (entry === '.starciwork') { finding('HFS_WORK_IN_FE', entry, 'The fe side must not hold a .starciwork tree; Work records live in the app root .starciwork.'); continue; }
      if (entry === 'src') { finding('HFS_ROOT_SRC_FORBIDDEN_FE', entry, 'The fe side keeps source only under apps/<app>/src; the fe/src/ tree must move.'); continue; }
    }
    if (frontend && !backend && (isFeTestPath(entry) || isFeTestPath(`${entry}/x`))) continue;
    if (!state.allowed.has(entry)) finding('HFS_ROOT_ENTRY_FORBIDDEN', entry, `Root entry ${entry} of the ${profile} side is not in the slots of the ${profile} side.`);
  }
}

function checkRequiredRootEntries(state) {
  for (const entry of [...requiredRootEntries(state.resolver)].sort(byCodeUnit)) {
    if (entry === 'apps') continue;
    if (!state.tree.top.includes(entry)) state.finding('HFS_ROOT_ENTRY_MISSING', entry, `The ${state.profile} side requires root entry ${entry}.`);
  }
}

function checkApplicationRequiredFiles(state, app) {
  const { tree, backend, frontend, resolver, finding } = state;
  const missing = [];
  if (!tree.hasDir(`apps/${app}`)) {
    finding('HFS_APP_LAYOUT_INVALID', `apps/${app}`, `Application entry apps/${app} must be a directory.`);
    return;
  }
  if (!tree.hasDir(`apps/${app}/src`)) missing.push('src/');
  // A back-end app must hold exactly what the slot of its kind requires (each kind's slot names its own requires).
  if (backend) for (const required of resolver.requiredFiles(`apps/${app}/src/main.ts`)) {
    const directory = required.endsWith('/');
    if (!(directory ? tree.hasDir(required.slice(0, -1)) : tree.hasFile(required))) missing.push(required.slice(`apps/${app}/`.length));
  }
  // next-env.d.ts is generated by Next and commonly ignored by Git; it is not
  // a reliable tracked-tree input.
  // A front-end app holds the files its slot requires at its own root (next.config.ts, tsconfig.json, ...; it has no package.json).
  if (frontend) for (const required of resolver.requiredFiles(`apps/${app}/next.config.ts`).filter(entry => !entry.slice(`apps/${app}/`.length).includes('/'))) {
    if (!tree.hasFile(required)) missing.push(required.slice(`apps/${app}/`.length));
  }
  if (missing.length) finding('HFS_APP_LAYOUT_INVALID', `apps/${app}`, `Application apps/${app} lacks ${missing.join(', ')} required by the HFS app layout.`);
}

function checkApplications(state) {
  const { tree, finding } = state;
  const apps = tree.children('apps').sort(byCodeUnit);
  if (!tree.hasDir('apps') || apps.length === 0)
    finding('HFS_APPS_REQUIRED', 'apps', 'Every HFS repository is an apps/<app>/ monorepo; apps/ must hold at least one application.');
  for (const app of apps) checkApplicationRequiredFiles(state, app);
  return apps;
}

function checkBackendSourceLayout(state) {
  if (!state.backend) return;
  const { tree, resolver, finding } = state;
  for (const child of tree.children('src').sort(byCodeUnit)) {
    if (!BACKEND_SRC_CHILDREN.has(child))
      finding('HFS_SRC_LAYOUT_INVALID', `src/${child}`, `Backend src/ holds only features/, modules/ and tests/; ${child} must move to its owner.`);
  }
  for (const tier of tree.children('src/modules').sort(byCodeUnit)) {
    if (!moduleTiersOf(resolver).has(tier))
      finding('HFS_MODULE_TIER_INVALID', `src/modules/${tier}`, `Module tier ${tier} is not one of ${[...moduleTiersOf(resolver)].sort(byCodeUnit).join(', ')}.`);
  }
  const testChildren = slotTestChildren(resolver);
  for (const child of tree.children('src/tests').sort(byCodeUnit)) {
    // A file directly below src/tests/ that a slot owns (src/tests/tsconfig.json, be.tool-config) is that slot's, not a stray folder.
    if (!testChildren.has(child) && resolver.classifyPath(`src/tests/${child}`).status !== 'owned')
      finding('HFS_SRC_LAYOUT_INVALID', `src/tests/${child}`, `Backend src/tests/ holds only ${[...testChildren].join(', ')} and the files a slot owns there; ${child} must move.`);
  }
}

function checkTestTopology(state) {
  // Test kinds and folders that do not exist: int-spec, harness-spec, src/tests/harness and live/;
  // a backend spec sits by its kind (beside its subject, or under src/tests/{integration,e2e,contract}/).
  for (const file of state.tree.files()) {
    if (UNSUPPORTED_TEST_SUFFIX.test(file))
      state.finding('BE_TEST_TOPOLOGY', file, `${file} uses an unsupported test kind. Only unit *.spec.ts, *.integration-spec.ts, *.e2e-spec.ts and *.contract-spec.ts exist, each in its own folder under src/tests/.`);
    else if (state.backend && UNSUPPORTED_TEST_FOLDER.test(file))
      state.finding('BE_TEST_TOPOLOGY', file, `${file} sits in an unsupported test folder. Unit specs sit beside their subject, flows go under src/tests/e2e/<area>/ and test infrastructure under src/tests/world/.`);
    else if (state.backend && file.startsWith('src/tests/') && EXTRA_TEST_CONFIG.test(file))
      state.finding('BE_TEST_TOPOLOGY', file, `${file} is a per-lane test config. One root jest.config.js declares exactly the unit, integration, e2e and contract projects.`);
  }
}

export function checkHfs(config) {
  const kinds = config.kinds ?? [];
  const backend = kinds.includes('backend');
  const frontend = kinds.includes('frontend');
  if (!backend && !frontend) return { violations: [], coverage: { status: 'not-applicable' } };
  const tree = treeView(config.root);
  const violations = [];
  const finding = (ruleId, entry, message) => violations.push({ ruleId, path: entry, line: 1, column: 1, message });
  const profile = backend ? 'be' : 'fe';
  const resolver = resolverOf(config.root, profile, config.hfs);
  const state = { config, tree, violations, finding, backend, frontend, profile, resolver, allowed: slotRootEntries(resolver, profile) };
  checkSideRootEntries(state);
  checkRequiredRootEntries(state);
  const apps = checkApplications(state);
  checkBackendSourceLayout(state);
  checkTestTopology(state);
  if (backend) testTreesOutOfDefaultProgram({ root: config.root, tree, finding });
  return {
    violations,
    coverage: { status: 'checked', source: tree.source, rootEntries: tree.top.length, apps, ruleIds: [...HFS_RULE_IDS] },
  };
}

/**
 * The HFS tree check of the app root (`resolver` is the app's): the README, the root entries the app-root slots allow and require,
 * the automatic gates (hooks, the root scripts they call, the workflows) and the hooks path. `starci app check` runs it once per app; the
 * machine runs checkHfs once per side folder.
 */
export function checkAppRoot({ root, resolver, tree = treeView(root) }) {
  const violations = [];
  const finding = (ruleId, entry, message) => violations.push({ ruleId, path: entry, line: 1, column: 1, message });
  violations.push(...checkRepoPresentation({ root, tree, profile: 'app', edition: resolver.repo?.edition ?? 'full' }).violations);
  const allowed = slotRootEntries(resolver, 'app');
  for (const entry of [...tree.top].sort(byCodeUnit)) {
    if (NON_NPM_ENTRIES.has(entry) || /\.md$/iu.test(entry)) continue;
    if (!allowed.has(entry)) finding('HFS_ROOT_ENTRY_FORBIDDEN', entry, `Root entry ${entry} is not in the slots of the app root.`);
  }
  for (const entry of [...requiredRootEntries(resolver)].sort(byCodeUnit)) {
    if (entry === 'README.md' || entry === '.gitattributes') continue;   // checkRepoPresentation reports these two
    if (!tree.top.includes(entry)) finding('HFS_ROOT_ENTRY_MISSING', entry, `The app root requires root entry ${entry}.`);
  }
  const jestConfig = resolver.sides ? `be/${[...braceVariants(resolver.slot('be.tool-config').path)].find(file => file.startsWith('jest.config.'))}` : null;
  e2eInAutomaticGate({ root, tree, jestConfig, finding });
  const hooksPath = hooksPathNotRedirected({ root, finding });
  return { violations, coverage: { status: 'checked', source: tree.source, hooksPath, rootEntries: tree.top.length } };
}

/** Keep tree findings visible even when the TypeScript architecture config is invalid. */
export function checkHfsWithoutConfig(repositoryRoot) {
  let root;
  try { root = fs.realpathSync(path.resolve(repositoryRoot)); } catch {
    return { violations: [], coverage: { status: 'unavailable', reason: 'repository root is unavailable' } };
  }
  let kinds = [];
  try {
    const opened = openHfs({ repoRoot: root });
    // The app root is judged by checkAppRoot; a side folder by its side's tree check.
    if (opened.repo.profile === 'app') return checkAppRoot({ root, resolver: opened });
    if (opened.repo.profile === 'be') kinds = ['backend'];
    else if (opened.repo.profile === 'fe') kinds = ['frontend'];
  } catch { /* A malformed hfs.json remains an HFS_DECLARATION_INVALID error. */ }
  if (!kinds.length) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['@nestjs/core']) kinds.push('backend');
      if (deps.next) kinds.push('frontend');
    } catch { /* The architecture error still reports the missing input. */ }
  }
  return checkHfs({ root, kinds });
}
