import fs from 'node:fs';
import path from 'node:path';
import { isIP } from 'node:net';
import { gitOutput } from '../../lib/git.mjs';
import { repositoryName } from '../../lib/repo-identity.mjs';
import { braceVariants } from '../../lib/glob.mjs';
import { createSlotResolver, loadSlotManifest, openHfs } from '../../lib/hfs-slots.mjs';
import { isFeTestPath } from '../../lib/hfs-rules/fe-no-tests.mjs';

/**
 * HFS repository-tree check (knowledge/hfs/README.md): every StarCi repository is an
 * apps/<app>/ monorepo on npm with a fixed root-entry allowlist; backend composition lives in
 * apps/<app>/src and shared source under src/{features,modules,tests} with the three module tiers
 * domain/platform/integrations; frontend source lives only under apps/<app>/src. The judged tree is
 * the tracked one (`git ls-files` from the target root); a target outside a work tree falls back to
 * the filesystem view so fixtures and un-tracked checkouts are judged the same way.
 */

export const HFS_RULE_IDS = [
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
  'HFS_STACKS_IN_FE',
  'HFS_TEST_KIND_RETIRED',
  'HFS_WORK_IN_FE',
];

const NON_NPM_ENTRIES = new Set(['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb']);
const RUNTIME_ROOT_MARKDOWN = new Set(['README.md', 'CONTEXT.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'THIRD_PARTY_NOTICES.md']);
const PRODUCT_ROOT_MARKDOWN = new Set(['README.md']);
const README_SECTIONS = ['Overview', 'Stack', 'Repository layout', 'Development'];
const BACKEND_SRC_CHILDREN = new Set(['features', 'modules', 'tests']);
const MODULE_TIERS = new Set(['domain', 'integrations', 'platform']);
// Owner test layout 2026-09-30: unit `<name>.spec.ts`, integration, e2e and contract by folder and suffix; int-spec and harness-spec stay banned.
const RETIRED_TEST_SUFFIX = /\.(?:int|harness)-spec\.[cm]?[jt]sx?$/u;
const RETIRED_TEST_FOLDER = /^src\/tests\/(?:harness|live|e2e\/live)(?:\/|$)/u;
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
    const top = gitOutput(['rev-parse', '--show-toplevel'], { cwd: root }).trim();
    const same = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
    return same(fs.realpathSync(path.resolve(top)), fs.realpathSync(path.resolve(root)));
  } catch {
    return false;
  }
}

/** The tracked paths under the given root, relative to it: the pathspec keeps a nested directory from listing the paths of its enclosing clone. */
function gitPaths(root) {
  try {
    // An empty index is still a Git tree. Falling back to disk in that case would count
    // untracked build output as repository content.
    gitOutput(['rev-parse', '--is-inside-work-tree'], { cwd: root });
    const out = gitOutput(['ls-files', '--cached', '-z', '--', '.'], { cwd: root, maxBuffer: 256 * 1024 * 1024 });
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

function privateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0' ||
      /(?:\.localhost|\.local|\.internal|\.lan)$/u.test(host)) return true;
  if (isIP(host) === 6) return /^(?:::|f[cd][0-9a-f]*:|fe[89ab][0-9a-f]*:)/iu.test(host);
  if (!host.includes('.')) return true;
  const octets = host.split('.');
  if (octets.length !== 4 || !octets.every(part => /^\d{1,3}$/u.test(part) && Number(part) <= 255)) return false;
  const [a, b] = octets.map(Number);
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127;
}

// The scripts the README Development section shows; each is required only when the managed package-scripts template of the
// profile (packages/hfs/templates/<profile>/package-scripts/package.json, the one source of the managed script names) has it.
const DEVELOPMENT_SCRIPTS = ['typecheck', 'lint', 'build', 'test'];
// The templates sit beside the runtime in a checkout (packages/hfs/templates) and one level above the bundled runtime of @starci/hfs.
const TEMPLATE_ROOTS = [path.resolve(import.meta.dirname, '..', '..', '..', 'packages', 'hfs', 'templates'), path.resolve(import.meta.dirname, '..', '..', '..', '..', 'templates')];
const managedScriptCache = new Map();

/** The script names of the managed package-scripts template of a profile. The template holds a {{appScripts}} placeholder, so it is read by key, not parsed as JSON. */
function managedScriptNames(profile) {
  if (!managedScriptCache.has(profile)) {
    const file = TEMPLATE_ROOTS.map(dir => path.join(dir, profile, 'package-scripts', 'package.json')).find(candidate => fs.existsSync(candidate));
    if (!file) throw Error(`The managed package-scripts template of profile ${profile} cannot be found next to the runtime.`);
    managedScriptCache.set(profile, new Set([...fs.readFileSync(file, 'utf8').matchAll(/^\s*"([A-Za-z0-9:_.-]+)":\s*"/gmu)].map(match => match[1])));
  }
  return managedScriptCache.get(profile);
}

/** The README command that runs a managed script: `npm test` for test, `npm run <name>` for the others (never a longer script name that starts with it). */
function scriptCommand(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(name === 'test' ? 'npm (?:run test|test)(?![\\w:-])' : `npm run ${escaped}(?![\\w:-])`, 'u');
}

/** Presentation checks shared by the product HFS gate and this runtime's own standalone gate. */
export function checkRepoPresentation({ root, runtime = false, tree = treeView(root), profile = 'be' }) {
  const violations = [];
  const finding = (ruleId, entry, message, line = 1) => violations.push({ ruleId, path: entry, line, column: 1, message });
  for (const entry of tree.top) {
    if (/\.md$/iu.test(entry) && !(runtime ? RUNTIME_ROOT_MARKDOWN : PRODUCT_ROOT_MARKDOWN).has(entry))
      finding('HFS_ROOT_MARKDOWN_FORBIDDEN', entry, `Root Markdown ${entry} belongs under docs/ or the owning Work record.`);
    if (NON_NPM_ENTRIES.has(entry))
      finding('HFS_PACKAGE_MANAGER_MIXED', entry, `${entry} contradicts the npm package manager contract.`);
  }
  for (const entry of ['.gitattributes', 'README.md']) {
    if (!tree.hasFile(entry)) finding('HFS_ROOT_ENTRY_MISSING', entry, `Repository presentation requires root ${entry}.`);
  }
  if (tree.hasFile('package.json')) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
      if (pkg.packageManager && !/^npm@\d/u.test(pkg.packageManager))
        finding('HFS_PACKAGE_MANAGER_MIXED', 'package.json', `packageManager ${pkg.packageManager} contradicts the npm package-lock.json contract.`);
    } catch { /* The repository's package/config checks own unreadable or invalid JSON. */ }
  }
  if (!tree.hasFile('README.md')) return { violations, coverage: { status: 'checked', source: tree.source } };
  let readme;
  try { readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8'); }
  catch {
    finding('HFS_ROOT_ENTRY_MISSING', 'README.md', 'Tracked README.md is not readable.');
    return { violations, coverage: { status: 'checked', source: tree.source } };
  }
  const lines = readme.split(/\r?\n/u);
  const name = runtime ? 'StarCi' : repositoryName(root);
  if (lines[0].trim().toLowerCase() !== `# ${name}`.toLowerCase())
    finding('HFS_README_TITLE_INVALID', 'README.md', `README.md must start with # ${name}.`);
  const description = lines.slice(1).find(line => line.trim());
  if (!description || /^\s*(?:#|!\[|\[!\[)/u.test(description) || description.trim().length > 240)
    finding('HFS_README_DESCRIPTION_INVALID', 'README.md', 'Place one concise description line directly below the repository name.');
  const headings = lines.map((line, index) => ({ name: /^## (.+?)\s*$/u.exec(line)?.[1], index })).filter(item => item.name);
  const required = [...README_SECTIONS, ...(tree.hasDir('.starciwork') ? ['Work'] : [])];
  let previous = -1;
  for (const section of required) {
    const found = headings.find(item => item.name === section);
    if (!found) finding('HFS_README_SECTION_MISSING', 'README.md', `README.md requires a ## ${section} section.`);
    else if (found.index <= previous) finding('HFS_README_SECTION_ORDER', 'README.md', `## ${section} must follow the preceding standard section.`, found.index + 1);
    else previous = found.index;
  }
  const sectionBody = section => {
    const start = headings.find(item => item.name === section)?.index;
    if (start === undefined) return '';
    const end = headings.find(item => item.index > start)?.index ?? lines.length;
    return lines.slice(start + 1, end).join('\n');
  };
  if (!runtime && headings.some(item => item.name === 'Development')) {
    const development = sectionBody('Development');
    const scripts = DEVELOPMENT_SCRIPTS.filter(name => managedScriptNames(profile).has(name));
    const commands = [/npm (?:ci|install)/u, ...scripts.map(scriptCommand)];
    if (commands.some(command => !command.test(development)))
      finding('HFS_README_DEVELOPMENT_INCOMPLETE', 'README.md',
        `Development must show npm install and the managed script commands: ${scripts.map(name => (name === 'test' ? 'npm test' : `npm run ${name}`)).join(', ')}.`);
  }
  if (tree.hasDir('.starciwork') && headings.some(item => item.name === 'Work') &&
      !/\.starciwork\b/u.test(sectionBody('Work')))
    finding('HFS_README_WORK_POINTER_MISSING', 'README.md', 'Work must point at the backend .starciwork tree.');
  let fenced = false;
  lines.forEach((line, index) => {
    if (/^\s*```/u.test(line)) { fenced = !fenced; return; }
    if (fenced) return;
    const prose = line.replace(/`[^`]*`/gu, '');
    for (const match of prose.matchAll(/https?:\/\/[^\s<>)"']+/giu)) {
      const value = match[0].replace(/[.,;!?]+$/u, '');
      try {
        if (privateHost(new URL(value).hostname))
          finding('HFS_README_PRIVATE_URL', 'README.md', `README URL ${value} points at a local or private host.`, index + 1);
      } catch { /* Malformed URLs are outside this presentation rule. */ }
    }
    const badgeTargets = [
      ...[...prose.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/gu)].map(match => ({ alt: match[1], target: match[2] })),
      ...[...prose.matchAll(/<img\b[^>]*>/giu)].map(match => ({
        alt: /\balt=["']([^"']*)["']/iu.exec(match[0])?.[1] ?? '',
        target: /\bsrc=["']([^"']*)["']/iu.exec(match[0])?.[1] ?? '',
      })),
    ];
    for (const { alt, target: rawTarget } of badgeTargets) {
      const target = rawTarget.trim().replace(/^<|>$/gu, '');
      if (!/badge/iu.test(alt) && !/badge|shields\.io|badgen\.net/iu.test(target)) continue;
      try {
        const url = new URL(target);
        if (url.protocol !== 'https:' || privateHost(url.hostname) ||
            /^(?:img\.shields\.io|badgen\.net)$/iu.test(url.hostname) && /^\/badge\//u.test(url.pathname))
          finding('HFS_README_BADGE_NOT_LIVE', 'README.md', `Badge ${target} must represent a live external HTTPS service.`, index + 1);
      } catch { finding('HFS_README_BADGE_NOT_LIVE', 'README.md', `Badge ${target} must use a live external HTTPS service.`, index + 1); }
    }
  });
  return { violations, coverage: { status: 'checked', source: tree.source } };
}

// Owner ruling 2026-09-29 (layout 2026-09-30): integration, e2e and contract run MANUALLY only. No hook, default typecheck,
// coverage run or automatic CI trigger may include those trees or run those projects. Linting the e2e files is not running them: ESLint reads them
// as syntax in the one repository-wide lint run (the factory's e2e block), so no `lint:e2e` command exists to judge.
const E2E_COMMAND = /\btest:(?:e2e|integration|contract)\b|\btypecheck:tests\b|--selectProjects\s+(?:e2e|integration|contract)\b|src\/tests\/(?:world|integration|e2e|contract)\b|jest[^\n|&;]*(?:e2e|integration|contract)/u;
const UNIT_RUN_SCRIPTS = ['test', 'test:unit', 'test:ci', 'test:affected', 'test:coverage', 'test:cov'];
// An --ignore-pattern names the e2e tree to keep it OUT of a command; it is not a run of e2e.
const runsE2e = text => E2E_COMMAND.test(String(text).replace(/--ignore-pattern[= ]+(?:"[^"]*"|'[^']*'|\S+)/gu, ''));
const withoutComments = text => text.split('\n').filter(line => !/^\s*#/u.test(line)).join('\n');

function readText(root, relative) {
  try { return fs.readFileSync(path.join(root, ...relative.split('/')), 'utf8'); } catch { return null; }
}

// A repository-local core.hooksPath that points anywhere but husky's own directory switches the commit and push
// hooks off for that clone (a lane once redirected it to skip husky), so the gate every other clone runs never ran.
// Husky itself sets core.hooksPath to .husky/_ ; that value and .husky are the only ones allowed.
const HUSKY_HOOKS_PATH = /^\.husky(?:\/_)?\/?$/u;

/** A directory that is not the top level of its own work tree has no hooks of its own: the check is not applicable there. */
function hooksPathNotRedirected({ root, finding }) {
  if (!ownsGitTopLevel(root)) return { status: 'not-applicable', reason: 'the checked root is not the top level of its own Git work tree, so it has no hooks of its own' };
  let value = '';
  try {
    value = gitOutput(['config', '--local', '--get', 'core.hooksPath'], { cwd: root }).trim();
  } catch { return { status: 'checked' }; } // key not set: nothing is redirected
  if (value && !HUSKY_HOOKS_PATH.test(value.replaceAll('\\', '/')))
    finding('HFS_HOOKS_PATH_REDIRECTED', '.git/config', `core.hooksPath is set to ${value} in this clone. Unset it (git config --local --unset core.hooksPath) and let husky own the hooks; a redirected path skips the pre-commit and pre-push gates.`);
  return { status: 'checked' };
}

/**
 * The app root's automatic gates never run integration, e2e or contract: the husky hooks and the root scripts they call, the unit
 * scripts over the be side's jest configuration (`jestConfig`, app-relative), and the workflows that start on push or pull_request.
 */
function e2eInAutomaticGate({ root, tree, jestConfig, finding }) {
  const rule = 'HFS_E2E_IN_AUTOMATIC_GATE';
  let pkg = null;
  try { pkg = JSON.parse(readText(root, 'package.json') ?? ''); } catch { /* the package checks own invalid JSON */ }
  const scripts = pkg?.scripts ?? {};
  // 1. Husky hooks and the scripts they call (transitively through `npm run <script>`).
  const pending = [];
  for (const hook of ['.husky/pre-commit', '.husky/pre-push']) {
    const text = readText(root, hook);
    if (text === null) continue;
    const body = withoutComments(text);
    if (runsE2e(body)) finding(rule, hook, `${hook} runs integration, e2e or contract. They are manual only; hooks run unit, lint and typecheck.`);
    for (const match of body.matchAll(/npm\s+run\s+([\w:.-]+)/gu)) pending.push(match[1]);
  }
  const lintStaged = pkg?.['lint-staged'];
  if (lintStaged && runsE2e(Object.values(lintStaged).flat().join('\n'))) finding(rule, 'package.json', 'lint-staged runs an integration, e2e or contract command. They are manual only.');
  const called = new Set();
  for (const name of pending) {
    if (called.has(name)) continue;
    called.add(name);
    const command = scripts[name];
    if (typeof command !== 'string') continue;
    if (runsE2e(command)) finding(rule, 'package.json', `Script ${name} is run by a husky hook and touches integration, e2e or contract. They are manual only.`);
    for (const match of command.matchAll(/npm\s+run\s+([\w:.-]+)/gu)) pending.push(match[1]);
  }
  // 2. Unit and coverage scripts over the be side's jest configuration select the unit project only and exclude src/tests.
  if (tree.hasFile(jestConfig)) {
    for (const name of UNIT_RUN_SCRIPTS) {
      const command = scripts[name];
      if (typeof command === 'string' && /\bjest\b/u.test(command) && !/--selectProjects\s+unit\b/u.test(command))
        finding(rule, 'package.json', `Script ${name} runs jest without --selectProjects unit and would run the integration, e2e or contract project.`);
    }
    const jestText = readText(root, jestConfig) ?? '';
    if (/collectCoverageFrom/u.test(jestText) && !/!src\/tests\/(?:\*\*|e2e)/u.test(jestText))
      finding(rule, jestConfig, 'collectCoverageFrom must exclude src/tests/** so no integration, e2e or contract file counts toward coverage.');
  }
  // 3. A workflow that starts on push or pull_request never runs e2e.
  for (const file of tree.files().filter(entry => /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(entry))) {
    const text = readText(root, file);
    if (text === null) continue;
    const trigger = /^on:.*(?:\n(?:[ \t]+.*|)$)*/mu.exec(text)?.[0] ?? '';
    if (!/\b(?:push|pull_request)\b/u.test(trigger)) continue;
    if (runsE2e(withoutComments(text)))
      finding(rule, file, `${file} runs e2e on push or pull_request. Move the e2e job to its own workflow with on: workflow_dispatch only.`);
  }
}

/** The be side's default tsconfig excludes the world, integration, e2e and contract trees (they are checked by src/tests/tsconfig.json). */
function testTreesOutOfDefaultProgram({ root, tree, finding }) {
  const rule = 'HFS_E2E_IN_AUTOMATIC_GATE';
  const tsconfigText = readText(root, 'tsconfig.json');
  let tsconfig = null;
  try { tsconfig = tsconfigText === null ? null : JSON.parse(tsconfigText); } catch { /* the typecheck itself owns parsing */ }
  if (tsconfig) {
    const excludedText = JSON.stringify(tsconfig.exclude ?? []);
    const excludesTestTrees = ['world', 'integration', 'e2e', 'contract'].every(tree => excludedText.includes(`src/tests/${tree}`));
    const defaultAll = tsconfig.include === undefined && tsconfig.files === undefined;
    const files = tree.files();
    if (files.some(file => /^src\/tests\/(?:world|integration|e2e|contract)\/.+\.[cm]?tsx?$/u.test(file)) && !excludesTestTrees &&
        (defaultAll || JSON.stringify(tsconfig.include ?? []).includes('src')))
      finding(rule, 'tsconfig.json', 'The default tsconfig includes src/tests/{world,integration,e2e,contract}/**. Exclude those trees and check them with src/tests/tsconfig.json (typecheck:tests).');
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
  // The README, the hooks, the workflows and the scripts are the app root's (checkAppRoot); a side folder is judged as the old
  // repository root it stands for, less those.
  const allowed = slotRootEntries(resolver, profile);
  for (const entry of [...tree.top].sort()) {
    if (NON_NPM_ENTRIES.has(entry) || /\.md$/iu.test(entry)) continue;
    if (frontend && !backend) {
      if (entry === '.starciwork') { finding('HFS_WORK_IN_FE', entry, 'The fe side must not hold a .starciwork tree; Work records live in the app root .starciwork.'); continue; }
      if (entry === '.starcistacks') { finding('HFS_STACKS_IN_FE', entry, 'The fe side must not hold .starcistacks; stack declarations live in be/.starcistacks.'); continue; }
      if (entry === 'src') { finding('HFS_ROOT_SRC_FORBIDDEN_FE', entry, 'The fe side keeps source only under apps/<app>/src; the fe/src/ tree must move.'); continue; }
    }
    if (frontend && !backend && (isFeTestPath(entry) || isFeTestPath(`${entry}/x`))) continue;   // a test entry of a front end is FE_NO_TESTS's, the one finding of that path
    if (!allowed.has(entry)) {
      finding('HFS_ROOT_ENTRY_FORBIDDEN', entry, `Root entry ${entry} of the ${profile} side is not in the slots of the ${profile} side.`);
    }
  }

  for (const entry of [...requiredRootEntries(resolver)].sort()) {
    if (entry === 'apps') continue;
    if (!tree.top.includes(entry)) finding('HFS_ROOT_ENTRY_MISSING', entry, `The ${profile} side requires root entry ${entry}.`);
  }

  const apps = tree.children('apps').sort();
  if (!tree.hasDir('apps') || apps.length === 0) {
    finding('HFS_APPS_REQUIRED', 'apps', 'Every HFS repository is an apps/<app>/ monorepo; apps/ must hold at least one application.');
  }
  for (const app of apps) {
    const missing = [];
    if (!tree.hasDir(`apps/${app}`)) {
      finding('HFS_APP_LAYOUT_INVALID', `apps/${app}`, `Application entry apps/${app} must be a directory.`);
      continue;
    }
    if (!tree.hasDir(`apps/${app}/src`)) missing.push('src/');
    // A back-end app must hold exactly what the slot of its kind requires (be.app.migrate has no app.module.ts).
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

  if (backend) {
    for (const child of tree.children('src').sort()) {
      if (!BACKEND_SRC_CHILDREN.has(child)) {
        finding('HFS_SRC_LAYOUT_INVALID', `src/${child}`, `Backend src/ holds only features/, modules/ and tests/; ${child} must move to its owner.`);
      }
    }
    for (const tier of tree.children('src/modules').sort()) {
      if (!MODULE_TIERS.has(tier)) {
        finding('HFS_MODULE_TIER_INVALID', `src/modules/${tier}`, `Module tier ${tier} is not one of domain, platform, integrations.`);
      }
    }
    const testChildren = slotTestChildren(resolver);
    for (const child of tree.children('src/tests').sort()) {
      // A file directly below src/tests/ that a slot owns (src/tests/tsconfig.json, be.tool-config) is that slot's, not a stray folder.
      if (!testChildren.has(child) && resolver.classifyPath(`src/tests/${child}`).status !== 'owned') {
        finding('HFS_SRC_LAYOUT_INVALID', `src/tests/${child}`, `Backend src/tests/ holds only ${[...testChildren].join(', ')} and the files a slot owns there; ${child} must move.`);
      }
    }
  }

  // Retired test kinds and folders: int-spec and harness-spec are gone, so are src/tests/harness and
  // live/; a backend spec sits by its kind (beside its subject, or under src/tests/{integration,e2e,contract}/).
  for (const file of tree.files()) {
    if (RETIRED_TEST_SUFFIX.test(file))
      finding('HFS_TEST_KIND_RETIRED', file, `${file} uses a retired test kind. Only unit *.spec.ts, *.integration-spec.ts, *.e2e-spec.ts and *.contract-spec.ts exist, each in its own folder under src/tests/.`);
    else if (backend && RETIRED_TEST_FOLDER.test(file))
      finding('HFS_TEST_KIND_RETIRED', file, `${file} sits in a retired test folder. Unit specs sit beside their subject, flows go under src/tests/e2e/<area>/ and test infrastructure under src/tests/world/.`);
    else if (backend && /^src\/tests\//u.test(file) && EXTRA_TEST_CONFIG.test(file))
      finding('HFS_TEST_KIND_RETIRED', file, `${file} is a per-lane test config. One root jest.config.js declares exactly the unit, integration, e2e and contract projects.`);
  }

  if (backend) testTreesOutOfDefaultProgram({ root: config.root, tree, finding });

  return {
    violations,
    coverage: {
      status: 'checked',
      source: tree.source,
      rootEntries: tree.top.length,
      apps,
      ruleIds: [...HFS_RULE_IDS],
    },
  };
}

/**
 * The HFS tree check of the app root (`resolver` is the app's): the README, the root entries the app-root slots allow and require,
 * the automatic gates (hooks, the root scripts they call, the workflows) and the hooks path. `hfs check` runs it once per app; the
 * machine runs checkHfs once per side folder.
 */
export function checkAppRoot({ root, resolver, tree = treeView(root) }) {
  const violations = [];
  const finding = (ruleId, entry, message) => violations.push({ ruleId, path: entry, line: 1, column: 1, message });
  violations.push(...checkRepoPresentation({ root, tree, profile: 'app' }).violations);
  const allowed = slotRootEntries(resolver, 'app');
  for (const entry of [...tree.top].sort()) {
    if (NON_NPM_ENTRIES.has(entry) || /\.md$/iu.test(entry)) continue;
    if (!allowed.has(entry)) finding('HFS_ROOT_ENTRY_FORBIDDEN', entry, `Root entry ${entry} is not in the slots of the app root.`);
  }
  for (const entry of [...requiredRootEntries(resolver)].sort()) {
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
