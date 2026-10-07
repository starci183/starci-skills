// npm-install.mjs - add only exact dependency versions and report the manifest diff.
//
// A bare package name resolves through the runtime's canon pins. Explicit exact versions are accepted only when they
// agree with any canon pin, so this verb never asks the registry to choose a version.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { diff } from '../api/git/diff.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { install } from '../api/npm/install.mjs';
import { refusal as verbRefusal, resultOk as success, resultOutput as output } from '../lib/verb-call.mjs';
import { primaryWorktree, linkedNodeModules, lockedValue } from './npm-ci.mjs';
import { underHostLock, hostLockRetryBudget } from './verb-lock.mjs';

const PINS_FILE = 'knowledge/hfs/canon-pins.yaml';
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/;

/** Read the one package-name to exact-version map from canon-pins.yaml. */
function loadCanonPins(root = skillRoot) {
  const document = parseYaml(fs.readFileSync(path.join(root, PINS_FILE), 'utf8'));
  return Object.fromEntries(Object.entries(document?.pins ?? {}).map(([name, value]) => [name, String(value?.version ?? '')]));
}

function packageRequest(rawValue) {
  const raw = String(rawValue ?? '').trim();
  let name = raw;
  let version = null;
  const separator = raw.startsWith('@') ? raw.indexOf('@', 1) : raw.lastIndexOf('@');
  if (separator > 0) {
    name = raw.slice(0, separator);
    version = raw.slice(separator + 1);
  }
  if (!PACKAGE_NAME.test(name)) return { ok: false, error: `invalid package name: ${raw || '<empty>'}` };
  if (version !== null && !EXACT_VERSION.test(version)) {
    return { ok: false, error: `${raw} is not an exact x.y.z version; ranges and tags are refused` };
  }
  return { ok: true, raw, name, version };
}

/** Resolve requested packages without registry lookups. */
export function resolveInstallPackages(requested, pins) {
  const resolved = [];
  for (const value of requested ?? []) {
    const parsed = packageRequest(value);
    if (!parsed.ok) return parsed;
    const canon = pins?.[parsed.name] || null;
    if (!parsed.version && !canon) {
      return { ok: false, error: `${parsed.name} has no canon pin; ask the owner to pin it or provide an exact x.y.z version` };
    }
    if (parsed.version && canon && parsed.version !== canon) {
      return { ok: false, error: `${parsed.name}@${parsed.version} differs from its canon pin ${canon}` };
    }
    resolved.push(`${parsed.name}@${parsed.version ?? canon}`);
  }
  if (!resolved.length) return { ok: false, error: 'at least one package is required' };
  return { ok: true, packages: [...new Set(resolved)] };
}

/** Install exact dependencies under the host lock and return the package manifest diff stat. */
export async function npmInstall(ctx, deps = {}) {
  const cwd = path.resolve(ctx?.cwd ?? process.cwd());
  const refusal = (location, text, code = 2, extra = {}) => verbRefusal('starci npm install', text, code,
    { schema: 'starci/npm-install@1', ok: false, cwd: location, ms: 0, ...extra });
  const api = {
    diff: deps.diff ?? diff,
    install: deps.install ?? install,
    loadPins: deps.loadPins ?? loadCanonPins,
    lstat: deps.lstat ?? fs.lstatSync,
    lock: deps.underHostLock ?? underHostLock,
    now: deps.now ?? Date.now,
    revParse: deps.revParse ?? revParseQuery
  };
  const role = ctx?.role ?? 'owner';

  if (!['owner', 'release'].includes(role)) {
    const primary = primaryWorktree(cwd, api.revParse);
    if (!primary.ok) return refusal(cwd, `cannot prove this is an owned worktree: ${primary.error}`);
    if (primary.isPrimary) return refusal(cwd, 'the primary main worktree is reserved for the owner or release role');
  }

  const link = linkedNodeModules(cwd, api.lstat);
  if (!link.ok) return refusal(cwd, `cannot inspect node_modules: ${link.error}`);
  if (link.linked) return refusal(cwd, 'node_modules is a junction or symbolic link; remove it before npm install');

  let pins;
  try { pins = api.loadPins(); } catch (error) {
    return refusal(cwd, `cannot read canon pins: ${String(error?.message ?? error)}`);
  }
  const resolved = resolveInstallPackages(ctx?.positionals ?? [], pins);
  if (!resolved.ok) return refusal(cwd, resolved.error);

  try {
    const locked = await api.lock({ role, purpose: 'npm-install', env: ctx?.env, retry: hostLockRetryBudget() }, async () => {
      const started = api.now();
      const result = await api.install(cwd, resolved.packages, { dev: Boolean(ctx?.args?.dev) });
      const ms = Math.max(0, api.now() - started);
      const changed = api.diff(['--stat', '--', 'package.json', 'package-lock.json'], { cwd });
      const diffStat = success(changed) ? output(changed) || '(no package manifest changes)' : null;
      const common = { packages: resolved.packages, dev: Boolean(ctx?.args?.dev), diffStat, ms };
      if (!result?.ok) {
        const detail = String(result?.stderr ?? '').trim() || `npm exited ${String(result?.status ?? 'without a status')}`;
        return refusal(cwd, `failed: ${detail}\ndiff stat: ${diffStat ?? 'unavailable'}`, 1, common);
      }
      if (diffStat === null) {
        return refusal(cwd, `packages were installed but the manifest diff stat could not be read: ${output(changed, 'stderr') || 'git diff failed'}`, 1,
          { ...common, installOk: true });
      }
      return {
        code: 0,
        text: `installed ${resolved.packages.join(', ')} in ${cwd}\ndiff stat: ${diffStat}`,
        data: { schema: 'starci/npm-install@1', ok: true, cwd, ...common }
      };
    }, deps);
    return lockedValue(locked);
  } catch (error) {
    return refusal(cwd, `host lock failed: ${String(error?.message ?? error)}`, 1, { packages: resolved.packages });
  }
}
