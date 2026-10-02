// ladder-select.mjs - shared repository selection for the ladder verbs.
// Git and Node stay behind their API call files; every exported helper accepts a fake dependency for specs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diff } from '../api/git/diff.mjs';
import { diffNames } from '../api/git/diff-names.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { porcelainStatus } from '../api/git/porcelain-status.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { pathList } from './test-ladder.mjs';

const slash = (value) => String(value).replaceAll(path.sep, '/').replace(/^\.\//, '');
const lines = (value) => String(value ?? '').split(/\r?\n/).map((line) => slash(line.trim())).filter(Boolean);
export const RUNTIME_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Spawn-result normalization shared by fake and real runners. */
export function runOutcome(result) {
  return {
    ok: result?.ok ?? (!result?.error && result?.status === 0),
    status: result?.status ?? (result?.ok ? 0 : 1),
    stdout: String(result?.stdout ?? result?.out ?? ''),
    stderr: String(result?.stderr ?? result?.err ?? result?.error?.message ?? result?.error ?? ''),
  };
}

/** Tracked/staged/working plus untracked files: the default L0/L1 change set. */
export function workingChanges(root, deps = {}) {
  if (deps.changedFiles) return pathList(deps.changedFiles(root));
  const runDiff = deps.diff ?? diff;
  const runLsFiles = deps.lsFiles ?? lsFiles;
  const tracked = runOutcome(runDiff(['--name-only', '--diff-filter=ACMR', 'HEAD'], { cwd: root }));
  const untracked = runOutcome(runLsFiles(['--others', '--exclude-standard'], { cwd: root }));
  return [...new Set([...lines(tracked.stdout), ...lines(untracked.stdout)])].sort();
}

/** Committed changes between the local-main reference and HEAD: the L2/L3 change set. */
export function committedChanges(root, against, deps = {}) {
  if (deps.changedAgainst) return pathList(deps.changedAgainst(root, against));
  const selected = (deps.diffNames ?? diffNames)(root, against, 'HEAD');
  return pathList(selected ?? []);
}

/** Whether the checkout has no staged, tracked-working or untracked changes. */
export function cleanTree(root, deps = {}) {
  if (deps.cleanTree) return Boolean(deps.cleanTree(root));
  const result = (deps.porcelainStatus ?? porcelainStatus)(root, { untracked: 'all' });
  return result?.ok === true && !String(result.stdout ?? '').trim();
}

/** Tracked files matching a Git pathspec. */
export function tracked(root, pathspec, deps = {}) {
  if (deps.trackedFiles) return pathList(deps.trackedFiles(root, pathspec));
  const result = runOutcome((deps.lsFiles ?? lsFiles)([pathspec], { cwd: root }));
  return result.ok ? lines(result.stdout) : [];
}

/** Runtime or product app, from the repository's declaration. */
export function repositoryKind(root, deps = {}) {
  if (deps.repositoryKind) return deps.repositoryKind(root);
  try { return JSON.parse(fs.readFileSync(path.join(root, 'hfs.json'), 'utf8')).kind === 'runtime' ? 'runtime' : 'app'; }
  catch { return 'app'; }
}

/** Run the installed starci bin without bypassing the CLI door. */
export function runStarci(root, argv, { cwd = root, env, maxBuffer = 64 * 1024 * 1024 } = {}, deps = {}) {
  if (deps.runStarci) return runOutcome(deps.runStarci(argv, { cwd, env, maxBuffer }));
  const bin = path.join(root, 'packages', 'cli', 'bin', 'starci.mjs');
  return runOutcome((deps.runNode ?? runNode)([bin, ...argv], { cwd, env, maxBuffer }));
}

/** Configured runtime self-checks, retaining the manifest's path-to-id relation. */
export function runtimeSelfChecks(root, deps = {}) {
  if (deps.runtimeSelfChecks) return deps.runtimeSelfChecks(root);
  const file = path.join(root, 'knowledge', 'hfs', 'runtime-slots.yaml');
  const manifest = parseYaml(fs.readFileSync(file, 'utf8'));
  return (manifest?.ruleParams?.runtime?.selfChecks ?? []).map((check) => ({ id: String(check.id), run: slash(check.run), args: [...(check.args ?? [])] }));
}

/** The self-check implementations directly changed by a working slice. */
export function selfChecksForChanges(root, changed, deps = {}) {
  const wanted = new Set(pathList(changed));
  return runtimeSelfChecks(root, deps).filter((check) => wanted.has(check.run));
}

/** Every real tsconfig project tracked below root. */
export function typeScriptProjects(root, deps = {}) {
  const files = deps.typeScriptProjects ? deps.typeScriptProjects(root) : tracked(root, '*tsconfig*.json', deps);
  return pathList(files).filter((file) => /(?:^|\/)tsconfig(?:\.[a-z0-9-]+)?\.json$/i.test(file)
    && !file.includes('/node_modules/') && !file.includes('/templates/'));
}

/** Deepest project(s) holding changed files (L1), or every project affected by a changed ancestor (L2/L3). */
export function projectsForChanges(projects, changed, { affected = false } = {}) {
  const dirs = projects.map((project) => ({ project, dir: slash(path.posix.dirname(project)).replace(/^\.$/, '') }));
  const selected = new Set();
  for (const file of pathList(changed)) {
    const owners = dirs.filter(({ dir }) => !dir || file === dir || file.startsWith(`${dir}/`));
    if (owners.length) {
      const depth = Math.max(...owners.map(({ dir }) => dir.split('/').filter(Boolean).length));
      for (const owner of owners.filter(({ dir }) => affected || dir.split('/').filter(Boolean).length === depth)) selected.add(owner.project);
    }
    if (affected) for (const item of dirs) if (item.dir.startsWith(`${file}/`) || item.project === file) selected.add(item.project);
  }
  return [...selected].sort();
}
