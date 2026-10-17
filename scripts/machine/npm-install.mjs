// npm-install.mjs - install exact dependencies and move the StarCi family with the target CLI's canon.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { diff } from '../api/git/diff.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { runNpm } from '../api/npm/run-npm.mjs';
import { withoutSeatEnv } from '../lib/seat-env.mjs';
import { refusal as verbRefusal, resultOk as success, resultOutput as output } from '../lib/verb-call.mjs';
import { ownedTreeRefusal, linkedNodeModules, lockedValue } from './npm-ci.mjs';
import { underHostLock, hostLockRetryBudget } from './verb-lock.mjs';

const PINS_FILE = 'knowledge/hfs/canon-pins.yaml';
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/;

/** Read the one package-name to exact-version map from canon-pins.yaml. */
function loadCanonPins(root = skillRoot) {
  const document = parseYaml(fs.readFileSync(path.join(root, PINS_FILE), 'utf8'));
  return Object.fromEntries(Object.entries(document?.pins ?? {}).map(([name, value]) => [name, String(value?.version ?? '')]));
}

/** Read the target CLI's own HFS dependency, never a stale sibling or the running runtime's pins. */
function loadTargetPins(cwd, version) {
  const cliFile = path.join(cwd, 'node_modules', '@starci', 'cli', 'package.json');
  const cli = JSON.parse(fs.readFileSync(cliFile, 'utf8'));
  if (cli.name !== '@starci/cli' || cli.version !== version) throw new Error(`installed @starci/cli does not match target ${version}`);
  const hfsFile = createRequire(cliFile).resolve('@starci/hfs/package.json');
  const hfs = JSON.parse(fs.readFileSync(hfsFile, 'utf8'));
  if (hfs.name !== '@starci/hfs' || hfs.version !== cli.dependencies?.['@starci/hfs']) throw new Error('installed @starci/hfs does not match the target CLI dependency');
  const pins = loadCanonPins(path.join(path.dirname(hfsFile), 'runtime'));
  if (pins['@starci/cli'] !== version || pins['@starci/hfs'] !== hfs.version) throw new Error('target canon pins do not match the installed CLI and HFS');
  return pins;
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
  if (version !== null && !EXACT_VERSION.test(version)) return { ok: false, error: `${raw} is not an exact x.y.z version; ranges and tags are refused` };
  return { ok: true, raw, name, version };
}

/** Resolve requested packages without registry lookups. */
function resolveInstallPackages(requested, pins) {
  const resolved = [];
  for (const value of requested ?? []) {
    const parsed = packageRequest(value);
    if (!parsed.ok) return parsed;
    const canon = pins?.[parsed.name] || null;
    if (!parsed.version && !canon) return { ok: false, error: `${parsed.name} has no canon pin; ask the owner to pin it or provide an exact x.y.z version` };
    if (parsed.version && canon && parsed.version !== canon) return { ok: false, error: `${parsed.name}@${parsed.version} differs from its canon pin ${canon}` };
    const version = parsed.version ?? canon;
    if (!EXACT_VERSION.test(version)) return { ok: false, error: `${parsed.name} has an invalid canon pin ${version}` };
    resolved.push(`${parsed.name}@${version}`);
  }
  if (!resolved.length) return { ok: false, error: 'at least one package is required' };
  return { ok: true, packages: [...new Set(resolved)] };
}

/** Each pin result retains its exact status and optional refusal reason. */
function pinResultText(item) {
  const status = item.status === 'moved' ? 'pin moved' : 'NPM_INSTALL_REFUSED: pin refused';
  const reason = item.reason ? `: ${item.reason}` : '';
  return `${status} ${item.package}${reason}`;
}

/** Finish an install with its manifest diff, elapsed time and pin outcomes. */
function finishInstall(state, error = null, code = 1) {
  const { api, cwd, packages, dev, started, pinResults, refusal } = state;
  const changed = api.diff(['--stat', '--', 'package.json', 'package-lock.json'], { cwd });
  const diffStat = success(changed) ? output(changed) || '(no package manifest changes)' : null;
  const common = { packages, dev, diffStat, ms: Math.max(0, api.now() - started), pinResults };
  const pinText = pinResults.map(pinResultText).join('\n');
  const text = [error, pinText, `diff stat: ${diffStat ?? 'unavailable'}`].filter(Boolean).join('\n');
  if (error) return refusal(cwd, text, code, common);
  if (diffStat === null) return refusal(cwd, `packages were installed but the manifest diff stat could not be read\n${text}`, 1, { ...common, installOk: true });
  return { code: 0, text: `installed ${packages.join(', ')} in ${cwd}\n${text}`, data: { schema: 'starci/npm-install@1', ok: true, cwd, ...common } };
}

/** Convert an injected npm result or exception to its existing failure text. */
async function runInstall(api, cwd, dev, specs) {
  try {
    const result = await api.install(cwd, specs, { dev });
    return success(result) ? null : String(result?.stderr ?? result?.error?.message ?? '').trim() || `npm exited ${String(result?.status ?? 'without a status')}`;
  } catch (error) { return String(error?.message ?? error); }
}

/** Move the family only after reading and validating the installed target CLI canon. */
async function installCanonFamily({ api, cwd, target, requested, pinResults, packages, finish, run }) {
  let targetPins;
  try { targetPins = api.loadTargetPins(cwd, target); } catch (error) {
    return finish(`target @starci/cli@${target} installed; canon pins refused: ${String(error?.message ?? error)}`);
  }
  const family = Object.entries(targetPins).filter(([name]) => name.startsWith('@starci/'));
  const refused = family.filter(([name, version]) => !PACKAGE_NAME.test(name) || !EXACT_VERSION.test(version));
  if (!family.length || targetPins['@starci/cli'] !== target) {
    return finish('target canon pins refused: missing StarCi pins or mismatched CLI target');
  }
  const final = resolveInstallPackages([...requested, ...family.map(([name, version]) => `${name}@${version}`)], targetPins);
  if (refused.length || !final.ok) {
    const reason = refused.length ? 'target canon contains invalid exact pins' : final.error;
    for (const [name, version] of family) pinResults.push({ package: `${name}@${version}`, status: 'refused', reason });
    return finish(reason, 2);
  }
  const failure = await run(final.packages);
  for (const [name, version] of family) pinResults.push({ package: `${name}@${version}`, status: failure ? 'refused' : 'moved', ...(failure ? { reason: failure } : {}) });
  if (failure) return finish(`canon install failed: ${failure}`);
  packages.splice(0, packages.length, ...final.packages);
  return finish();
}

/** Install exact dependencies under the host lock; a CLI upgrade reads pins only after the target CLI has installed. */
export async function npmInstall(ctx, deps = {}) {
  const cwd = path.resolve(ctx?.cwd ?? process.cwd());
  const refusal = (location, text, code = 2, extra = {}) => verbRefusal('NPM_INSTALL_REFUSED', text, code,
    { schema: 'starci/npm-install@1', ok: false, cwd: location, ms: 0, ...extra });
  const runner = deps.runNpm ?? runNpm;
  const api = {
    diff: deps.diff ?? diff,
    install: deps.install ?? ((location, packages, { dev }) => runner(['install', '--prefer-offline', '--no-audit', '--no-fund', '--save-exact', ...(dev ? ['--save-dev'] : []), ...packages],
      { cwd: location, timeout: 900_000, env: withoutSeatEnv(ctx?.env ?? process.env) })),
    loadPins: deps.loadPins ?? loadCanonPins,
    loadTargetPins: deps.loadTargetPins ?? loadTargetPins,
    lstat: deps.lstat ?? fs.lstatSync,
    lock: deps.underHostLock ?? underHostLock,
    now: deps.now ?? Date.now,
    revParse: deps.revParse ?? revParseQuery
  };
  const role = ctx?.role ?? 'owner';
  const unowned = ownedTreeRefusal(cwd, role, api.revParse, refusal);
  if (unowned) return unowned;
  const link = linkedNodeModules(cwd, api.lstat);
  if (!link.ok) return refusal(cwd, `cannot inspect node_modules: ${link.error}`);
  if (link.linked) return refusal(cwd, 'node_modules is a junction or symbolic link; remove it before npm install');

  const requested = ctx?.positionals ?? [];
  const parsed = requested.map(packageRequest);
  const invalid = parsed.filter((item) => !item.ok);
  if (invalid.length) return refusal(cwd, invalid.map((item) => item.error).join('\n'));
  const cliRequests = parsed.filter((item) => item.name === '@starci/cli');
  const canon = Boolean(ctx?.args?.canon) || cliRequests.length > 0;
  let pins;
  try { pins = api.loadPins(); } catch (error) { return refusal(cwd, `cannot read canon pins: ${String(error?.message ?? error)}`); }
  const versions = [...new Set(cliRequests.map((item) => item.version ?? pins['@starci/cli']))];
  if (versions.length > 1) return refusal(cwd, 'conflicting @starci/cli targets');
  const target = versions[0] ?? pins['@starci/cli'];
  if (canon && !EXACT_VERSION.test(target ?? '')) return refusal(cwd, '@starci/cli has no exact canon target');
  const resolved = canon ? { ok: true, packages: [`@starci/cli@${target}`] } : resolveInstallPackages(requested, pins);
  if (!resolved.ok) return refusal(cwd, resolved.error);

  try {
    const locked = await api.lock({ role, purpose: 'npm-install', env: ctx?.env, retry: hostLockRetryBudget() }, async () => {
      const started = api.now();
      const packages = [];
      const pinResults = [];
      const dev = Boolean(ctx?.args?.dev);
      const state = { api, cwd, packages, dev, started, pinResults, refusal };
      const finish = (error, code) => finishInstall(state, error, code);
      const run = (specs) => runInstall(api, cwd, dev, specs);
      const failure = await run(resolved.packages);
      if (failure) {
        if (canon) pinResults.push({ package: resolved.packages[0], status: 'refused', reason: failure });
        return finish(`npm install failed: ${failure}`);
      }
      packages.push(...resolved.packages);
      if (!canon) return finish();

      return installCanonFamily({ api, cwd, target, requested, pinResults, packages, finish, run });
    }, deps);
    return lockedValue(locked);
  } catch (error) {
    return refusal(cwd, `host lock failed: ${String(error?.message ?? error)}`, 1, { packages: resolved.packages });
  }
}
