// Target-bound native consumers retain the application's installed deployment and database owners.
import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from '../../engine/digest.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { canonicalJSON } from '../../engine/canonical-json.mjs';
import { byCodeUnit } from '../../engine/by-code-unit.mjs';
import { resolveProvisionTarget } from './provision-target.mjs';
import { runProvisionOperation, provisionNativeChildEnvironment } from './provision-operation.mjs';
import { provisionNativeApp } from '../api/process/provision-native-app.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { statusQuery } from '../api/git/status-query.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { appProvisionEnv } from '../lib/provision-workspace-contract.mjs';
import { secretHits } from '../lib/secret-patterns.mjs';
import { normalizeDeploy } from '../hfs/stack-deploy-config.mjs';
import { loadPins } from './canon-pins.mjs';

const OWNERS = ['stack/target-binding.mjs', 'stack/cli.mjs', 'stack/remote.mjs', 'stack/docker-transport.mjs', 'db/migrate.mjs', 'db/local-migrate.mjs'];
const CODES = new Set(['native-consumer-outcome-unknown', 'native-stack-health-only', 'native-stack-deploy-verified',
  'native-database-current', 'native-database-pending', 'native-consumer-source-drift', 'native-database-not-armed', 'native-stack-reconcile-held']);
const held = code => ({ outcome: 'failed', code, writeAck: false, publicReadback: false, consumerVerified: false });
const same = (left, right) => canonicalJSON(left) === canonicalJSON(right);
const fail = () => { throw new Error('NATIVE_CONSUMER_DECLARATION_REFUSED'); };

function ordinaryPublicFile(root, name) {
  if (!name || name.split(/[\\/]/).some(part => ['..', '.', 'secrets'].includes(part)) || /(?:(?:^|\/)\.env(?:\.|$)|\.enc$)/i.test(name)) fail();
  let current = root;
  for (const part of name.split(/[\\/]/)) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) fail();
  }
  const stat = fs.statSync(current);
  if (!stat.isFile() || stat.size > 16 * 1024 * 1024) fail();
  const bytes = fs.readFileSync(current);
  if (secretHits(name, bytes.toString('utf8')).length) fail();
  return bytes;
}

function cleanSource(target, revision) {
  const status = statusQuery(['--porcelain', '--untracked-files=normal'], { cwd: target.repoRoot });
  return /^[a-f0-9]{40}$/.test(revision ?? '') && revParse(target.repoRoot, 'HEAD') === revision
    && status.status === 0 && String(status.stdout).trim() === '';
}

function resourceOf(target) {
  const resource = target.resource;
  if (!resource || Object.keys(resource).some(key => !['revision', 'timeoutMs', 'publicEnvironment', 'images'].includes(key))
    || !cleanSource(target, resource.revision) || !Number.isInteger(resource.timeoutMs) || resource.timeoutMs < 1000 || resource.timeoutMs > 7200000) fail();
  const publicEnvironment = resource.publicEnvironment ?? {};
  appProvisionEnv(publicEnvironment, {}, {});
  if (Object.keys(publicEnvironment).some(key => /^(?:ORCA_|TRACEPARENT$|TRACESTATE$|SUPABASE_)/.test(key))) fail();
  if (target.provider === 'app-stack') {
    if (!resource.images || !Object.keys(resource.images).length || Object.entries(resource.images).some(([service, image]) =>
      !/^[a-z][a-z0-9-]*$/.test(service) || !/^[a-z0-9./_-]+(?::[A-Za-z0-9._-]+)?@sha256:(?!0{64}$)[a-f0-9]{64}$/.test(image))) fail();
  } else if (resource.images !== undefined) fail();
  return { revision: resource.revision, timeoutMs: resource.timeoutMs, publicEnvironment, images: resource.images ?? {} };
}

function databasePasswordReference(value) {
  if (!value || Object.keys(value).length !== 3 || !/^[a-z][a-z0-9-]*$/.test(value.env ?? '')
    || !/^[a-z][a-z0-9-]*$/.test(value.member ?? '') || !/^[A-Z][A-Z0-9_]*$/.test(value.key ?? '')) fail();
  return { env: value.env, member: value.member, key: value.key };
}

function stackSnapshot(target, resource, environment) {
  const endpoint = target.endpoint, base = `.starcistacks/${endpoint.environment}/`;
  const stackFile = environment.composeFiles?.[0];
  if (typeof stackFile !== 'string') fail();
  const model = parseYaml(ordinaryPublicFile(target.repoRoot, `${base}${stackFile}`).toString('utf8'));
  const { config: deploy } = normalizeDeploy(environment.deploy, { project: target.project,
    probe: { exists: rel => fs.existsSync(path.join(target.repoRoot, base, rel)), services: new Set(Object.keys(model?.services ?? {})), members: new Set() } });
  if (environment.runtime !== 'docker-swarm' || deploy?.stack !== endpoint.stack || !deploy.remote?.sealed
    || Object.keys(target.credentials).length || target.destination) fail();
  if (!same(Object.keys(deploy.images ?? {}).sort(byCodeUnit), Object.keys(resource.images).sort(byCodeUnit))
    || (deploy.passEnv ?? []).some(key => !Object.hasOwn(resource.publicEnvironment, key))) fail();
  const files = [...(environment.composeFiles ?? []).map(file => `${base}${file}`),
    ...(deploy.configs ?? []).map(entry => `${base}${entry.file}`),
    ...Object.values(deploy.environment ?? {}).flatMap(entry => (entry.files ?? []).map(file => `${base}${file}`))];
  const nativeCustody = { environment: endpoint.environment, remote: { ...deploy.remote.sealed }, secrets: deploy.secrets };
  const verification = { mayWrite: deploy.verify.exec.length > 0 || deploy.verify.http.some(check => !['GET', 'HEAD'].includes(check.method)),
    httpChecks: deploy.verify.http.length, execChecks: deploy.verify.exec.length };
  return { files, nativeCustody, verification };
}

function databaseCustody(target, database) {
  const endpoint = target.endpoint;
  if (endpoint.mode === 'url-env') {
    const ref = target.credentials['database-url'];
    if (!ref || ref.optional || ref.hostConnection || ref.env !== endpoint.urlEnv || Object.keys(target.credentials).length !== 1) fail();
    return ref;
  }
  if (Object.keys(target.credentials).length) fail();
  if (endpoint.mode !== 'linked') return null;
  const password = databasePasswordReference(database.password);
  if (database.projectRef !== endpoint.projectRef || password.env !== endpoint.environment) fail();
  return password;
}

function trackedDatabaseSql(target, directory) {
  if (!/^[A-Za-z0-9_/-]+$/.test(directory) || directory.split('/').includes('..')) fail();
  const tracked = lsFiles(['--cached', '-z', '--', directory], { cwd: target.repoRoot });
  const ignored = lsFiles(['--others', '--ignored', '--exclude-standard', '-z', '--', directory], { cwd: target.repoRoot });
  if (tracked.status !== 0 || ignored.status !== 0 || String(ignored.stdout).split('\0').some(name => name.endsWith('.sql'))) fail();
  return String(tracked.stdout).split('\0').filter(name => name.endsWith('.sql'));
}

function databaseSnapshot(target, declaration) {
  const database = declaration.database;
  if (target.endpoint.mode !== 'local' && !database) fail();
  const nativeCustody = databaseCustody(target, database);
  if (target.destination) fail();
  const directories = ['supabase/migrations'];
  if (target.endpoint.mode !== 'local') {
    directories[0] = database.migrationsDir ?? 'supabase/migrations';
    if (database.archiveDir) directories.push(database.archiveDir);
  }
  return { files: [...directories.flatMap(directory => trackedDatabaseSql(target, directory)), 'supabase/config.toml'],
    nativeCustody, verification: null };
}

function publicSnapshot(target, resource) {
  const declaration = parseYaml(fs.readFileSync(target.declaration.path, 'utf8'));
  const environment = declaration.environments?.[target.endpoint.environment];
  if (environment?.status !== 'supported') fail();
  const selected = target.provider === 'app-stack' ? stackSnapshot(target, resource, environment) : databaseSnapshot(target, declaration);
  const files = ['package.json', 'package-lock.json', 'hfs.json', ...selected.files];
  const tracked = lsFiles(['--cached', '-z'], { cwd: target.repoRoot });
  const names = new Set(String(tracked.stdout).split('\0'));
  if (tracked.status !== 0 || files.some(file => !names.has(file))) fail();
  return { files: Object.fromEntries([...new Set(files)].sort(byCodeUnit).map(file => [file, sha256(ordinaryPublicFile(target.repoRoot, file))])),
    nativeCustody: selected.nativeCustody, verification: selected.verification };
}

function nativeActionFor(family, action, reconcile) {
  if (!reconcile) return action;
  return family === 'stack' ? 'verify' : 'inspect';
}

function nativeEnvironment(ctx, target, resource, callbacks, family, nativeAction) {
  const requireAge = family === 'stack' || target.endpoint.mode === 'linked';
  const env = { ...provisionNativeChildEnvironment(ctx.env, ctx.provisionNativeContext(), { age: requireAge }), ...resource.publicEnvironment };
  if (family === 'db') {
    env.SUPABASE_ENV = target.endpoint.environment;
    if (nativeAction === 'migrate') env.STARCI_DB_ARMED = ctx.env.STARCI_DB_ARMED;
    if (target.endpoint.mode === 'url-env') env[target.endpoint.urlEnv] = callbacks.credentials['database-url'];
  }
  return env;
}

async function nativeOperation(ctx, provider, family, allowed) {
  try {
    const action = ctx.positionals?.[0];
    if (!allowed.includes(action) || typeof ctx.provisionNativeContext !== 'function') fail();
    const target = resolveProvisionTarget({ cwd: ctx.cwd, targetId: ctx.args.target, provider });
    if (target.transport !== 'native' || !target.endpoint || target.origin !== null || !target.actions.includes(`${family}.${action}`)) fail();
    const resource = resourceOf(target), configuration = publicSnapshot(target, resource);
    const requiredHfsFiles = Object.fromEntries(OWNERS.map(file => [file, sha256(fs.readFileSync(path.join(skillRoot, 'packages/hfs', file)))]));
    const supabaseVersion = family === 'db' ? loadPins().pins.supabase.version : undefined;
    const installed = await provisionNativeApp({ repoRoot: target.repoRoot, requiredHfsFiles, supabaseVersion });
    const invoke = async (callbacks, reconcile) => {
      if (!cleanSource(target, resource.revision) || !same(publicSnapshot(target, resource), configuration)) return held('native-consumer-source-drift');
      if (reconcile && configuration.verification?.mayWrite) return { outcome: callbacks.operation.writeAck ? 'partial' : 'unknown',
        code: 'native-stack-reconcile-held', writeAck: callbacks.operation.writeAck, publicReadback: false, consumerVerified: false };
      const nativeAction = nativeActionFor(family, action, reconcile);
      if (family === 'db' && nativeAction === 'migrate' && ctx.env.STARCI_DB_ARMED !== '1') return held('native-database-not-armed');
      callbacks.assertAuthority();
      const env = nativeEnvironment(ctx, target, resource, callbacks, family, nativeAction);
      callbacks.checkpoint({ phase: `native-${family}-${nativeAction}-intent` });
      const result = await provisionNativeApp({ repoRoot: target.repoRoot, mode: 'run', requiredHfsFiles, expectedIdentity: installed,
        supabaseVersion, family, action: nativeAction, endpoint: target.endpoint, revision: resource.revision, images: resource.images, env, timeoutMs: resource.timeoutMs });
      if (result.writeAck) callbacks.acknowledge({ ...(result.resourceId ? { resourceId: result.resourceId } : {}), phase: `native-${family}-acknowledged` });
      if (!cleanSource(target, resource.revision) || !same(publicSnapshot(target, resource), configuration))
        return { ...result, outcome: result.writeAck ? 'partial' : 'unknown', code: 'native-consumer-source-drift', consumerVerified: false };
      return result;
    };
    return await runProvisionOperation(ctx, { action: `${family}.${action}`, target, requestId: ctx.args.operation,
      execute: ctx.args.execute, credentialRefs: target.credentials, destination: null, resultCodes: CODES,
      publicResource: { revision: resource.revision, endpoint: target.endpoint },
      plan: { resource, configuration, installed, endpoint: target.endpoint, databaseArming: family === 'db' && action === 'migrate' ? 'existing-STARCI_DB_ARMED-required' : 'not-applicable',
        recovery: family === 'stack' ? 'read-only-checks-only-or-retained-unknown-without-replay' : 'native-read-only-migration-history',
        effects: { nativeOwner: true, deployment: family === 'stack' && action === 'deploy',
          declaredVerificationMayWrite: configuration.verification?.mayWrite ?? false,
          migration: family === 'db' && action === 'migrate', reset: false, teardown: false } },
      apply: callbacks => invoke(callbacks, false), reconcile: callbacks => invoke(callbacks, true) });
  } catch { return { code: 2, data: { ok: false, code: 'native-consumer-prerequisite-refused' },
    text: 'Declare the exact native endpoint, clean source, matching installed HFS capability and native custody before preparing this operation. No native consumer was launched.' }; }
}

/** Bind deploy or declared verification to the existing native Swarm owner; frozen exec checks may have remote effects. */
export const runNativeStack = ctx => nativeOperation(ctx, 'app-stack', 'stack', ['deploy', 'verify']);

/** Bind migration or history inspection to the existing native database owner without arming a database. */
export const runNativeDatabase = ctx => nativeOperation(ctx, 'app-db', 'db', ['migrate', 'inspect']);
