// npm-hooks.mjs - the git hooks of a checkout after `starci npm ci` or `starci npm install`. An install whose lifecycle scripts did
// not run (`--ignore-scripts`, an npmrc `ignore-scripts=true`, a workspace-only or skipped install) leaves core.hooksPath naming a
// folder husky never generated, and every later commit runs no pre-commit gate. After a successful install the app's declared hook
// installer (the root package.json `prepare` script when it invokes husky) runs whenever the hooks folder is not installed
// (scripts/lib/git-hooks-dir.mjs), and the verb reports the outcome; hooks still missing after the installer ran fail the verb.
import fs from 'node:fs';
import path from 'node:path';
import { configGet } from '../api/git/config-get.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { runNpm } from '../api/npm/run-npm.mjs';
import { hooksDirState } from '../lib/git-hooks-dir.mjs';
import { withoutSeatEnv } from '../lib/seat-env.mjs';
import { resultDetail, resultOk as success, resultOutput as output } from '../lib/verb-call.mjs';

const INSTALLER = 'prepare';
const HOOK_TOOL = /\bhusky\b/u;

/** The declared hook installer of the package at `cwd`: its `prepare` script when that invokes husky, else null. */
function declaredInstaller(cwd) {
  try {
    const script = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'))?.scripts?.[INSTALLER];
    return typeof script === 'string' && HOOK_TOOL.test(script) ? script : null;
  } catch {
    return null;
  }
}

/** `{ installed, hooksPath, dir?, state }` of the checkout at `cwd`: core.hooksPath (any scope) resolved against the work tree's top level. */
function hooksOf(cwd, api) {
  const set = api.configGet(cwd, 'core.hooksPath');
  const hooksPath = success(set) ? output(set) : '';
  if (!hooksPath) return { installed: false, hooksPath: null, state: 'unset' };
  const top = api.revParse(['--show-toplevel'], { cwd });
  const root = success(top) && output(top) ? output(top) : cwd;
  const judged = hooksDirState(root, hooksPath);
  return { installed: judged.state === 'installed', hooksPath, dir: judged.dir, state: judged.state };
}

/**
 * Install the git hooks of the checkout at `cwd` when the install left them missing. Returns `{ state, ... }`: `not-declared` (no
 * husky `prepare`), `installed` (already in place), `repaired` (the installer ran and the hooks are in place), `not-set` (the
 * installer ran and set no core.hooksPath) or `failed` (with `detail`). `deps` replaces configGet, revParse and runNpm in a spec.
 */
export function ensureGitHooks(cwd, { env = process.env, ...deps } = {}) {
  const api = { configGet: deps.configGet ?? configGet, revParse: deps.revParse ?? revParseQuery, runNpm: deps.runNpm ?? runNpm };
  const installer = declaredInstaller(cwd);
  if (!installer) return { state: 'not-declared' };
  const before = hooksOf(cwd, api);
  if (before.installed) return { state: 'installed', installer, hooksPath: before.hooksPath };
  // `npm run` runs a named script even under ignore-scripts; the install's own identity rules apply (scripts/lib/seat-env.mjs).
  const run = api.runNpm(['run', INSTALLER], { cwd, timeout: 300_000, env: withoutSeatEnv(env) });
  const after = hooksOf(cwd, api);
  if (success(run) && after.installed) return { state: 'repaired', installer, hooksPath: after.hooksPath, was: before.state };
  // The installer ran and chose to set no hooks path (husky's own opt-out, a checkout git does not know): nothing points at a missing folder.
  if (success(run) && after.state === 'unset') return { state: 'not-set', installer, was: before.state };
  const failure = resultDetail(run) || 'exit ' + String(run?.status ?? 'none');
  const why = success(run) ? `core.hooksPath ${after.hooksPath} is ${after.state} after the installer ran` : `npm run ${INSTALLER} failed: ${failure}`;
  return { state: 'failed', installer, hooksPath: after.hooksPath, was: before.state, detail: why };
}

/** The one report line of a hooks outcome. */
export function hooksLine(hooks) {
  if (hooks.state === 'not-declared') return 'git hooks: no husky prepare script is declared';
  if (hooks.state === 'installed') return `git hooks: installed (${hooks.hooksPath})`;
  if (hooks.state === 'repaired') return `git hooks: ${hooks.was} -> installed by npm run ${INSTALLER} (${hooks.hooksPath})`;
  if (hooks.state === 'not-set') return `git hooks: npm run ${INSTALLER} ran and set no core.hooksPath`;
  return `git hooks: NOT installed: ${hooks.detail}; run npm run ${INSTALLER} at the checkout root before committing`;
}
