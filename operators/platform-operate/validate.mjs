// platform.operate's own law over one branch, on top of the shared step check: the branch's closed
// effect, proof and capability sets; the approved plan hash and the approval that covers it — an
// approval id, or the environment's declaration by path and hash where it marks the operation's class
// declared; every
// desired resource inventoried under the same kind and inside the mutable ceiling; port claims owned
// by this operation and never freed by mutating their holder; every mutation inventoried first and
// inside the approved set; convergence agreeing with the mutation count; the complete proof set
// passed before an operated outcome; and no capability handle or credential-shaped token anywhere.
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { hostRootOf, missingStack } from '../../scripts/validate-request.mjs';
import { platformAuthorityErrors } from '../../scripts/platform-authority.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function integrationChangesErrors(delta, text, { verifyGit = true } = {}) {
  const errors=[], ladder=delta?.runtimeLadder, binding=Object.fromEntries(tableUnder(text,'## Binding')??[]);
  if(delta?.serviceKind!=='runtime' || ladder?.rung!=='serve' || !ladder.integration || ladder.reused || delta.convergence!=='converged')return ['changes: only a completed serve merge emits integration changes'];
  if(binding.Operator!=='platform.operate' || binding.Head!==ladder.servedHead || binding.Branch!==ladder.integration.branch)errors.push('changes: operator, head and branch must match the served integration delta');
  if(!/^[0-9a-f]{40}$/.test(binding.Base??''))errors.push('changes: Base must identify the integration predecessor commit');
  if(verifyGit)try{
    const cwd=ladder.integration.worktreeRef;
    if(!path.isAbsolute(cwd))throw new Error('integration changes require the resolved worktree path');
    const git=(args)=>execFileSync('git',args,{cwd,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
    if(git(['rev-parse','HEAD'])!==binding.Head || git(['branch','--show-current'])!==binding.Branch)errors.push('changes: actual integration checkout head or branch differs');
    const parents=git(['rev-list','--parents','-n','1',binding.Head]).split(' ');
    if(parents.length>=3 ? parents[1]!==binding.Base : ladder.observed?.head!==binding.Base)errors.push('changes: Base must be the actual merge first parent or the observed fast-forward predecessor');
    if(git(['merge-base',binding.Base,binding.Head])!==binding.Base)errors.push('changes: Base must be an ancestor of the served head');
    const actual=git(['diff','--name-only','--no-renames',binding.Base,binding.Head]).split('\n').filter(Boolean).sort();
    const rows=tableUnder(text,'## Files')??[], recorded=rows.map(([file])=>file).sort();
    if(JSON.stringify(actual)!==JSON.stringify(recorded))errors.push('changes: Files must equal the actual merged Git diff');
  }catch{errors.push('changes: actual merged Git provenance cannot be verified');}
  return errors;
}

// The three service kinds are branches of one job. Each publishes its own closed effect set, its own
// required proof set, and the exact capabilities it needs; a cross-filed effect is how an unapproved
// change acquires the appearance of authority.
export const KIND_EFFECTS = {
  observability: ['update-config', 'restart-service', 'upsert-dashboard', 'update-remote-write'],
  sonar: ['create-project', 'assign-profile', 'assign-gate', 'enforce-setting'],
  tunnel: ['create-tunnel', 'update-tunnel-route', 'upsert-proxied-dns'],
  runtime: ['register-runtime-entry', 'attest-runtime-entry', 'bring-up-infra-stack', 'locate-routed-checkouts', 'start-role-runtime', 'merge-into-integration-branch', 'serve-runtime-head', 'restart-runtime-server', 'reset-runtime-server', 'stop-runtime-server', 'queue-runtime-lease'],
  identity: ['provision-identity', 'seed-flow-fixtures', 'rotate-admin-credential'],
};
// The join from an effect to the class of authorisation an environment declares for it. The classes,
// their defaults and the reference shape are the environment schema's; an effect with no class here is
// one no declaration authorises, so its approval is always an id.
export const EFFECT_CLASSES = {
  'provision-identity': 'identity-provisioning',
  'seed-flow-fixtures': 'seed',
  'bring-up-infra-stack': 'stack-up',
  ...Object.fromEntries(KIND_EFFECTS.runtime.filter((e) => e !== 'bring-up-infra-stack').map((e) => [e, 'runtime'])),
};
export function operationClasses(kind, effects) {
  return {
    classes: [...new Set(effects.map((e) => EFFECT_CLASSES[e]).filter(Boolean))],
    unclassified: effects.filter((e) => !EFFECT_CLASSES[e]),
  };
}
// The runtime branch publishes its proof set per rung, not per branch: a rung below the server cannot
// probe an endpoint nothing is serving yet. KIND_CHECKS.runtime is the union those rungs draw from.
const SERVER_RUNG_CHECKS = ['entry-declared', 'endpoints-served', 'head-observed', 'generation-advanced', 'integration-merged', 'server-pid-owned', 'lease-honoured'];
// serve is the one rung that merges a session's work in, so it is the one rung that can meet a
// conflicting hunk; it resolves that itself and gates the merged head before restarting, and
// gates-passed is what proves the gate ran and came back green.
export const RUNG_CHECKS = {
  'stack-up': ['infra-ports-open', 'cors-origin-admitted', 'generation-advanced'],
  locate: ['checkout-located', 'head-observed', 'generation-advanced'],
  'start-role': SERVER_RUNG_CHECKS,
  serve: [...SERVER_RUNG_CHECKS, 'gates-passed'],
  restart: SERVER_RUNG_CHECKS,
  reset: SERVER_RUNG_CHECKS,
  stop: ['entry-declared', 'generation-advanced', 'server-pid-owned', 'lease-honoured'],
};
// A serve that only took a queue position merged nothing and started nothing, so it proves the lease
// it honoured and the entry it wrote, and nothing about a server it did not touch.
export const QUEUED_CHECKS = ['entry-declared', 'generation-advanced', 'lease-honoured'];
export const KIND_CHECKS = {
  observability: ['service-health', 'target-boundary', 'label-boundary', 'remote-write-delivery', 'sample-ordering', 'retry-backoff', 'sensitive-data-filter'],
  sonar: ['service-available', 'project-exists', 'source-revision', 'profile-assigned', 'gate-assigned', 'enforcement-active'],
  tunnel: ['dns-target', 'tunnel-route', 'tls', 'public-https'],
  runtime: [...new Set([...Object.values(RUNG_CHECKS).flat(), ...QUEUED_CHECKS])],
  identity: ['provider-reachable', 'credential-resolvable', 'account-exists', 'account-signs-in', 'no-credential-recorded'],
};
export const KIND_CAPABILITIES = {
  observability: ['metrics:remote-write'],
  sonar: ['sonar:project-admin'],
  tunnel: ['tunnel:write', 'dns:write'],
  runtime: ['runtime:registry-write'],
  identity: ['identity:account-admin'],
};
// One rung, one effect. Every rung attests on top of it, because a status nobody probed is an
// assertion; a reused or queued serve applies no rung effect at all, having started nothing.
export const RUNG_EFFECTS = {
  'stack-up': 'bring-up-infra-stack',
  locate: 'locate-routed-checkouts',
  'start-role': 'start-role-runtime',
  serve: 'serve-runtime-head',
  restart: 'restart-runtime-server',
  reset: 'reset-runtime-server',
  stop: 'stop-runtime-server',
};
// The rungs that leave a process running, and therefore a pid the entry owns and a head to attest.
export const RUNGS_THAT_START = new Set(['start-role', 'serve', 'restart', 'reset']);
// One finding per outcome, so a receipt says which rung it climbed without being read twice.
export const RUNG_FINDINGS = {
  'stack-up': 'RUNTIME_RUNG_CLIMBED',
  locate: 'RUNTIME_RUNG_CLIMBED',
  'start-role': 'RUNTIME_HEAD_SERVED',
  serve: 'RUNTIME_HEAD_SERVED',
  restart: 'RUNTIME_SERVER_RESTARTED',
  reset: 'RUNTIME_SERVER_RESET',
  stop: 'RUNTIME_SERVER_STOPPED',
};

// The two branches that act for one bound project route. Both address the registry entry of that
// route, so the route key is the resource they operate and nothing else may stand in for it.
export const ROUTE_KINDS = new Set(['runtime', 'identity']);
export const ROUTE_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

// A credential is resolved for use, never written down. Fingerprints and commit heads are legitimate
// long hex, so they are scrubbed before the unbroken-run heuristic runs.
export function credentialLeak(value) {
  if (value.includes('capability://')) return true;
  const scrubbed = value.replaceAll(/sha256:[0-9a-f]{64}/g, '').replaceAll(/\b[0-9a-f]{40}\b/g, '');
  if (/(?:token|secret|password|api[_-]?key|bearer|authorization)\s*[:=]\s*\S/i.test(scrubbed)) return true;
  return /[A-Za-z0-9+=]{32,}/.test(scrubbed);
}
function forEachString(value, visit, at = '$') {
  if (typeof value === 'string') return visit(value, at);
  if (Array.isArray(value)) { value.forEach((item, i) => forEachString(item, visit, `${at}[${i}]`)); return; }
  if (value !== null && typeof value === 'object') for (const [k, child] of Object.entries(value)) forEachString(child, visit, `${at}.${k}`);
}
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const asList = (v) => (Array.isArray(v) ? v : []);

// Rotation is an explicit approval-id operation, not a non-production provisioning default.
// Its provider, principal and complete protected write set are frozen by the request.
export function identityRotationErrors(requirements, rotation) {
  const errors = [];
  const requested = requirements.desiredState?.effects?.includes('rotate-admin-credential');
  const bound = requirements.identityRotation;
  if (!requested) { if (bound || rotation) errors.push('identityRotation requires the rotation effect'); return errors; }
  if (requirements.desiredState.effects.length !== 1) errors.push('rotation cannot combine other identity effects');
  if (!bound || !bound.provider || !bound.realm || !bound.credentialName || !/^sha256:[a-f0-9]{64}$/.test(bound.principalFingerprint ?? '') || !Array.isArray(bound.custodyRefs) || !bound.custodyRefs.length) errors.push('rotation requires exact provider, principal and protected custody');
  else {
    if (Object.keys(bound).some(k => !['provider', 'realm', 'credentialName', 'principalFingerprint', 'custodyRefs', 'stagingRefs'].includes(k))) errors.push('rotation binding contains unknown fields');
    if (!/^https?:\/\/[^\s]+$/.test(bound.provider) || !/^[a-zA-Z0-9._-]+$/.test(bound.realm)) errors.push('rotation provider or realm invalid');
    if (new Set(bound.custodyRefs).size !== bound.custodyRefs.length || bound.custodyRefs.some(ref => typeof ref !== 'string' || !ref.startsWith(`.stacks/${requirements.env}/`) || ref.includes('..') || ref.includes('\\') || ref.includes('/secrets/uat'))) errors.push('rotation custody must be exact protected environment files');
    if (!Array.isArray(bound.stagingRefs) || !bound.stagingRefs.length || bound.stagingRefs.some(ref => typeof ref !== 'string' || !ref.startsWith(`.stacks/${requirements.env}/`) || !ref.endsWith('.enc') || ref.includes('..') || ref.includes('\\') || bound.custodyRefs.includes(ref))) errors.push('rotation staging requires separately bound protected ciphertext paths');
    if (rotation) {
      for (const key of ['provider', 'realm', 'credentialName', 'principalFingerprint']) if (rotation[key] !== bound[key]) errors.push(`rotation ${key} differs from approved principal binding`);
      if (JSON.stringify([...rotation.custodyRefs].sort()) !== JSON.stringify([...bound.custodyRefs].sort())) errors.push('rotation custody differs from approved write set');
      for (const key of ['newCredentialWorks', 'oldCredentialRejected', 'sessionsInvalidated', 'custodyConsistent']) if (rotation[key] !== true) errors.push(`rotation requires ${key} proof`);
    }
  }
  return errors;
}

// The runtime ladder's own law, over the block the delta publishes. One server per route on one fixed
// port, served from one integration branch: a session gets its commit merged in and the server
// restarted on the result, or it waits behind the lease. Everything here is a statement the receipt
// has to make about a process that outlives the branch, because nothing else records it.
export function runtimeLadderErrors(ladder, { requirements, sessionId, applied, findings, gateFailed = false }) {
  const errors = [];
  const at = 'response/data/delta.json';
  // A red delivery gate stops serve before the server restarts: the merge into the integration branch
  // stands (that is what got gated), but nothing new started, so this rung proves nothing a started
  // rung proves.
  const started = RUNGS_THAT_START.has(ladder.rung) && !gateFailed;
  const queued = ladder.queuePosition !== null;
  const say = (m) => errors.push(`${at}: ${m}`);

  if (ladder.operation !== ladder.rung) say(`the operation is ${ladder.operation} and the rung recorded is ${ladder.rung}; a rung is the operation it climbed`);
  if (!empty(requirements.operation) && ladder.operation !== requirements.operation) say(`the ladder climbed ${ladder.operation}, which the request did not ask for`);
  if (!empty(requirements.routeKey) && ladder.routeKey !== String(requirements.routeKey)) say(`the ladder acts on ${ladder.routeKey}, not on the requested route ${requirements.routeKey}`);
  if (!empty(requirements.commit) && ladder.wantedCommit !== String(requirements.commit)) say('the wanted commit is not the one the request named');
  // Isolation: a session writes its own lease and no other session's.
  if (ladder.sessionId !== null && sessionId && ladder.sessionId !== sessionId) say(`the ladder acts for session ${ladder.sessionId}, and this branch belongs to ${sessionId}`);
  if (!applied.has('attest-runtime-entry')) say('every rung attests, because a status nobody probed is an assertion');

  const rungEffect = RUNG_EFFECTS[ladder.rung];
  if (ladder.reused || queued || gateFailed) {
    if (applied.has(rungEffect)) say(`${rungEffect} was applied although the operation ${gateFailed ? 'failed its delivery gate' : ladder.reused ? 'reused the running head' : 'only took a queue position'} and started nothing`);
  } else if (!applied.has(rungEffect)) say(`the ${ladder.rung} rung applies ${rungEffect}, which this delta never applied`);

  // Idempotent by head: a running server whose head already contains the wanted commit is re-attested
  // and returned. Restarting a healthy server unasked destroys what the next step was going to measure.
  if (ladder.rung === 'serve' && ladder.observed.containsWanted && ladder.observed.pidAlive && ladder.observed.probeAnswered && !ladder.reused && !queued) {
    say('the running head already contained the wanted commit and answered its probe, so serve reuses it rather than restarting a healthy server');
  }
  if (ladder.reused) {
    if (ladder.rung !== 'serve') say(`only serve is idempotent by head; ${ladder.rung} is asked for by name and always acts`);
    if (!ladder.observed.containsWanted) say('a reused head must be one the running server already contained');
    if (ladder.server === null || ladder.server.pid !== ladder.observed.pid) say('a reused head keeps the running process: no new pid appears');
    if (ladder.integration !== null) say('a reused head merged nothing');
  }

  // The lease is the merge order. One session integrates at a time, and a session that finds the
  // lease held is queued rather than given a second server.
  const foreign = ladder.observed.leaseSessionId !== null && ladder.observed.leaseSessionId !== ladder.sessionId;
  if (foreign && !queued) say(`the lease is held by session ${ladder.observed.leaseSessionId}, so this operation may only queue behind it`);
  if (queued) {
    if (!foreign) say('a queue position is recorded only behind a lease another session holds');
    if (ladder.rung !== 'serve') say(`${ladder.rung} is not a queueing operation`);
    if (!applied.has('queue-runtime-lease')) say('a queued serve applies queue-runtime-lease and nothing else');
    if (ladder.server !== null) say('a queued serve touched no server');
    if (ladder.integration !== null) say('a queued serve merged nothing');
    if (!findings.has('RUNTIME_LEASE_BUSY')) say('a queued serve records the RUNTIME_LEASE_BUSY finding, which is what the consumer is told to wait on');
  } else if (applied.has('queue-runtime-lease')) say('queue-runtime-lease belongs to a serve that took a queue position');

  // The server, and the pid a stop is allowed to kill.
  if (started && !ladder.reused && !queued) {
    if (ladder.server === null) say(`the ${ladder.rung} rung leaves a running server, and this delta records none`);
    else {
      if (ladder.server.previousPid !== ladder.observed.pid) say('the pid replaced must be the pid the entry recorded; a rung never replaces a process it does not own');
      if (ladder.server.pid === ladder.observed.pid) say('a rung that started a server records a new pid');
      if (ladder.servedHead === null) say('a rung that started a server records the head it serves');
      // A restart is not a rebuild. The build cache is cleared before the start whenever the declared
      // manifests moved since the previous record, or no previous record is known, or reset asked;
      // the record says which, and a kept cache over an unknown previous head is the defect itself.
      const cache = ladder.server.cache ?? null; // the schema refuses a record without one
      if (cache) {
        if (cache.cleared !== (cache.reason !== 'unchanged')) say(`the build-cache record says cleared ${cache.cleared} for reason ${cache.reason}; the cache is cleared exactly when a reason to clear it was recorded`);
        if (ladder.rung === 'reset' && !cache.cleared) say('the reset rung clears the build cache by definition, and this record says it was kept');
        if (cache.previousHead !== ladder.observed.head) say('the build-cache decision was made against a previous head other than the one the entry recorded');
        if (ladder.observed.head === null && cache.reason === 'unchanged') say('the previously served head is unknown, so nothing proves the manifests unchanged; the build cache is cleared');
      }
    }
  }
  if (ladder.rung === 'stop') {
    if (ladder.server !== null) say('a stopped entry runs no server');
    if (ladder.lease !== null) say('a stop releases the lease');
    if (ladder.servedHead !== ladder.observed.head) say('a stop keeps the head the entry served; it is overwritten only by the next merge');
  }
  // The merge that produces the served head, and the ancestry the consumers will read.
  const merged = applied.has('merge-into-integration-branch');
  if (merged && ladder.integration === null) say('a merge was applied and no integration record says what was merged into what');
  if (ladder.integration !== null) {
    if (!merged) say('the integration branch was written without merge-into-integration-branch among the applied effects');
    // A conflict no longer blocks the branch: serve resolves it under the closed rule set and records
    // every resolved hunk on the merge it belongs to, then gates the merged head before restarting.
    const anyResolutions = ladder.integration.merges.some((m) => m.resolutions.length > 0);
    if (anyResolutions !== ladder.integration.conflict) say('conflict must be true exactly when a merge here recorded a resolved hunk');
    if (anyResolutions && !findings.has('INTEGRATION_RESOLVED')) say('a merge that resolved a conflicting hunk records the INTEGRATION_RESOLVED finding, so the receipt names what serve resolved on its own');
    if (!anyResolutions && findings.has('INTEGRATION_RESOLVED')) say('INTEGRATION_RESOLVED is recorded only when a merge here actually resolved a conflicting hunk');
    for (const m of ladder.integration.merges) {
      if (m.mergeCommit === null) say(`the merge of ${m.ref} records no merge commit`);
      if (m.kind === 'session' && !gateFailed && !ladder.contains.includes(m.commit)) say(`commit ${m.commit} was merged and is absent from contains, so no consumer can prove its work is served`);
      if (m.kind === 'session' && gateFailed && ladder.contains.includes(m.commit)) say(`commit ${m.commit} failed its delivery gate and the server never restarted on it, so it cannot appear in the served head's contains`);
      if (m.kind !== 'session' && m.resolutions.length) say(`the ${m.kind} merge of ${m.ref} records resolutions; only the session merge meets a conflict serve resolves`);
    }
    if (ladder.rung === 'serve' && !ladder.integration.merges.some((m) => m.kind === 'session')) say('a serve merges the asking session branch, and this integration merged none');
  }
  if (ladder.wantedCommit !== null && started && !queued && !ladder.contains.includes(ladder.wantedCommit)) say('the wanted commit is not among the commits the served head contains');
  if (ladder.servedHead !== null && ladder.contains.length === 0) say('a served head contains at least the commit that was merged into it');

  // The rungs below the server.
  if (ladder.rung === 'stack-up') {
    if (ladder.infra === null) say('the stack-up rung records the infrastructure it brought up');
    else for (const s of ladder.infra.services) if (!s.ready) say(`infra service ${s.name} never reached readiness, which is PROVISIONING_UNAVAILABLE and not an applied rung`);
    if (ladder.server !== null) say('the stack-up rung starts no product server');
  } else if (ladder.infra !== null) say(`the ${ladder.rung} rung records no infrastructure; only stack-up does`);
  if (ladder.rung === 'locate') {
    if (!ladder.locations.length) say('the locate rung records the routed checkouts it resolved');
    if (ladder.server !== null) say('the locate rung starts no server');
  }
  if (ladder.rung === 'start-role') {
    const role = String(ladder.routeKey).split('/')[1];
    const here = ladder.locations.find((l) => l.role === role);
    if (!here) say(`the start-role rung starts the ${role} role and records no routed checkout for it`);
    else if (here.devCommand === null) say(`the ${role} route publishes no dev command, which is INVALID_INPUT naming the field it lacks`);
  }
  const finding = RUNG_FINDINGS[ladder.rung];
  const expected = ladder.reused ? 'RUNTIME_HEAD_REUSED' : finding;
  // A red gate is the one outcome where the rung's usual finding never lands: nothing was served, and
  // INTEGRATION_GATE_FAILED is what the receipt names instead.
  if (!queued && !gateFailed && !findings.has(expected)) say(`the receipt records ${expected}, so a reader knows which rung this run climbed`);
  return errors;
}

export async function validatePlatformStep(branchDir, root = ROOT, { hostRoot = hostRootOf(root) } = {}) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, request, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'platform.operate') return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');

  // An env names a stack of this installation; the vocabulary is the folder, not a list kept here.
  const missing = missingStack(root, requirements.env, hostRoot);
  if (missing) errors.push(`request.json: env ${requirements.env} names ${missing}, which this installation does not have`);

  const desired = requirements.desiredState ?? {};
  const kind = String(desired.serviceKind ?? '');
  const desiredEffects = asList(desired.effects);
  const desiredResources = asList(desired.resourceRefs);
  const mutable = new Set(asList(desired.mutableResourceRefs));
  const observationOnly = new Set(asList(desired.observationOnlyResourceRefs));
  const portClaims = asList(requirements.portClaims);
  const service = requirements.service;

  errors.push(...await platformAuthorityErrors({ root, hostRoot, requirements, kind, desiredEffects, operationClasses }));
  if (kind && !KIND_EFFECTS[kind]) errors.push(`request.json: ${kind} is not a service kind this operator operates`);
  if (KIND_EFFECTS[kind]) {
    if (new Set(desiredEffects).size !== desiredEffects.length) errors.push('request.json: desiredState.effects must not repeat an effect');
    for (const e of desiredEffects) if (!KIND_EFFECTS[kind].includes(e)) errors.push(`request.json: requested effect ${e} does not belong to the ${kind} service kind`);
  }
  if (!empty(service) && mutable.size && !mutable.has(service)) errors.push('request.json: the operated service must be inside desiredState.mutableResourceRefs');
  for (const r of mutable) if (observationOnly.has(r)) errors.push(`request.json: resource ${r} cannot be both mutable and observation-only`);
  for (const r of desiredResources) if (mutable.size && !mutable.has(r)) errors.push(`request.json: desired resource ${r} lies outside the mutable ceiling`);
  const claimedPorts = portClaims.map((c) => c.port);
  if (new Set(claimedPorts).size !== claimedPorts.length) errors.push('request.json: portClaims must not claim the same port twice');
  for (const c of portClaims) if (desiredResources.length && !desiredResources.includes(c.resourceRef)) errors.push(`request.json: port ${c.port} is claimed for ${c.resourceRef}, which this operation does not own`);
  // The input contract refuses any string that carries credential material.
  forEachString(request?.requirements ?? {}, (text, at) => { if (credentialLeak(text)) errors.push(`request.json: ${at} carries a credential value, which cannot enter the operator contract`); });

  let delta = null;
  if (present.has('delta') && has('response/data/delta.json')) { try { delta = JSON.parse(await read('response/data/delta.json')); } catch { delta = null; } }
  let checks = null;
  if (present.has('checks') && has('response/data/checks.json')) { try { checks = JSON.parse(await read('response/data/checks.json')); } catch { checks = null; } }
  // A red delivery gate is the one failure serve's own resolution work can produce: the merge into
  // the integration branch stands, gated, but nothing restarted on it.
  const gateFailed = Boolean(checks?.checks?.some((c) => c.name === 'gates-passed' && c.status === 'failed'));
  if(present.has('changes')) {
    if(response.status!=='done' || gateFailed)errors.push('changes: a failed or incomplete serve cannot publish merged delivery evidence');
    try{errors.push(...integrationChangesErrors(delta,await read('response/changes.md')));}catch{errors.push('changes: integration receipt is missing');}
  }

  let inventoried = new Set();
  if (delta) {
    const refs = delta.inventoriedResources.map((r) => r.resourceRef);
    inventoried = new Set(refs);
    if (new Set(refs).size !== refs.length) errors.push('response/data/delta.json: inventoriedResources must not list a resource twice');
    const ports = delta.observedPortHolders.map((h) => h.port);
    if (new Set(ports).size !== ports.length) errors.push('response/data/delta.json: observedPortHolders must not list the same port twice');
    if (!empty(service) && delta.serviceRef !== service) errors.push('response/data/delta.json: the delta operates a service the request did not name');
    if (!empty(service) && !inventoried.has(service)) errors.push(`response/data/delta.json: service ${service} was not inventoried before the operation`);
    if (kind && delta.serviceKind !== kind) errors.push(`response/data/delta.json: the delta names the ${delta.serviceKind} branch, not ${kind}`);
    const byRef = new Map(delta.inventoriedResources.map((r) => [r.resourceRef, r]));
    for (const r of desiredResources) {
      const res = byRef.get(r);
      if (!res) errors.push(`response/data/delta.json: desired resource ${r} is absent from the bound inventory`);
      else if (res.kind !== kind) errors.push(`response/data/delta.json: resource ${r} belongs to the ${res.kind} branch and is outside this ${kind} operation`);
    }
    if (!empty(requirements.approval) && delta.approvalRef !== requirements.approval) errors.push('response/data/delta.json: the bound approval is not the one the request declared');
    if (!empty(desired.planSha256) && delta.planSha256 !== desired.planSha256) errors.push('response/data/delta.json: planSha256 must equal the approved plan hash');
    for (const e of delta.allowedEffects) if (KIND_EFFECTS[kind] && !KIND_EFFECTS[kind].includes(e)) errors.push(`response/data/delta.json: approved effect ${e} does not belong to the ${kind} service kind`);
    for (const e of desiredEffects) if (!delta.allowedEffects.includes(e)) errors.push(`response/data/delta.json: requested effect ${e} is outside the approved effect set`);

    const held = delta.capabilities.map((c) => c.capability);
    if (new Set(held).size !== held.length) errors.push('response/data/delta.json: capabilities must not repeat a capability');
    for (const c of held) if (KIND_CAPABILITIES[kind] && !KIND_CAPABILITIES[kind].includes(c)) errors.push(`response/data/delta.json: capability ${c} is not used by the ${kind} branch`);
    for (const c of KIND_CAPABILITIES[kind] ?? []) if (!held.includes(c)) errors.push(`response/data/delta.json: the ${kind} branch requires the ${c} capability`);

    const portHolderRefs = new Set(delta.observedPortHolders.map((h) => h.holderRef));
    const applied = new Set(delta.appliedEffects);
    for (const effect of applied) {
      if (!desiredEffects.includes(effect)) errors.push(`response/data/delta.json: applied effect ${effect} is outside the requested effect set`);
      if (!delta.allowedEffects.includes(effect)) errors.push(`response/data/delta.json: applied effect ${effect} is outside the approved effect set`);
    }
    const mutatedEffects = new Set();
    for (const m of delta.mutations) {
      if (KIND_EFFECTS[kind] && !KIND_EFFECTS[kind].includes(m.effect)) errors.push(`response/data/delta.json: effect ${m.effect} does not belong to the ${kind} service kind`);
      if (!applied.has(m.effect)) errors.push(`response/data/delta.json: mutation effect ${m.effect} is absent from appliedEffects`);
      mutatedEffects.add(m.effect);
      if (!inventoried.has(m.resourceRef)) errors.push(`response/data/delta.json: resource ${m.resourceRef} was mutated without being inventoried first`);
      // A port already in use is a coordination finding, never permission to reclaim it.
      if (portHolderRefs.has(m.resourceRef)) errors.push(`response/data/delta.json: resource ${m.resourceRef} holds a claimed port and must never be mutated to free it`);
      if (delta.mutableResourceRefs.length && !delta.mutableResourceRefs.includes(m.resourceRef)) errors.push(`response/data/delta.json: resource ${m.resourceRef} was mutated outside the mutable ceiling`);
    }
    for (const e of applied) if (!mutatedEffects.has(e)) errors.push(`response/data/delta.json: applied effect ${e} records no mutation`);
    if (delta.convergence === 'already-converged' && delta.mutations.length > 0) errors.push('response/data/delta.json: an already-converged operation cannot report a mutation');
    if (delta.convergence === 'converged' && delta.mutations.length === 0) errors.push('response/data/delta.json: a converged operation must report the mutation that converged it');
    // The receipt is durable; a durable record of a capability is a leaked credential with a delay.
    forEachString(delta, (text, at) => { if (credentialLeak(text)) errors.push(`response/data/delta.json: ${at} records a credential, which the receipt refuses`); });
  } else if (response.status === 'done') errors.push('response/data/delta.json: a done branch needs the derived and applied delta');

  // The runtime branch climbs one rung of the ladder, and the rung decides both what it must apply and
  // what it must prove: a rung below the server cannot probe an endpoint nothing is serving yet.
  const ladder = delta?.runtimeLadder ?? null;
  const queuedServe = Boolean(ladder && ladder.queuePosition !== null);
  if (kind === 'runtime') {
    if (delta && !ladder) errors.push('response/data/delta.json: the runtime branch records the rung it climbed, and this delta carries no runtimeLadder');
  } else if (ladder) errors.push(`response/data/delta.json: runtimeLadder belongs to the runtime branch, not to ${kind || 'this'}`);
  const requiredChecks = kind === 'runtime'
    ? (ladder ? (queuedServe ? QUEUED_CHECKS : (RUNG_CHECKS[ladder.rung] ?? [])) : [])
    : (KIND_CHECKS[kind] ?? []);

  let findingCount = 0;
  if (checks) {
    if (!empty(service) && checks.serviceRef !== service) errors.push('response/data/checks.json: the proof set names a service the request did not operate');
    if (kind && checks.serviceKind !== kind) errors.push('response/data/checks.json: the proof set names another service kind');
    // The required proof set is the whole set the branch publishes; the caller cannot ask for less.
    const requested = new Set(checks.requiredCheckNames);
    for (const n of requiredChecks) if (!requested.has(n)) errors.push(`response/data/checks.json: the ${kind} branch must require the ${n} check`);
    for (const n of requested) if (KIND_CHECKS[kind] && !KIND_CHECKS[kind].includes(n)) errors.push(`response/data/checks.json: check ${n} does not belong to the ${kind} service kind`);

    const seen = new Set();
    const proved = new Set();
    for (const c of checks.checks) {
      const key = `${c.name}|${c.resourceRef}`;
      if (seen.has(key)) errors.push(`response/data/checks.json: check ${c.name} is recorded twice for ${c.resourceRef}`);
      seen.add(key);
      if (delta && !inventoried.has(c.resourceRef)) errors.push(`response/data/checks.json: check ${c.name} names uninventoried resource ${c.resourceRef}`);
      if (c.status === 'passed') proved.add(c.name);
      else if (response.status === 'done') errors.push(`response/data/checks.json: check ${c.name} failed, so the operation cannot be reported as operated`);
      // A red delivery gate after serve resolved a conflict is the only stop the resolution itself
      // produces, and it is INTEGRATION_FAILED and nothing else.
      if (c.name === 'gates-passed' && c.status === 'failed') {
        if (response.status === 'done') errors.push('response/data/checks.json: a failed delivery gate cannot end in an operated outcome');
        else if (response.stop !== 'INTEGRATION_FAILED') errors.push('response/response.json: a failed delivery gate requires the INTEGRATION_FAILED stop');
      }
    }
    if (response.status === 'done') for (const n of requiredChecks) if (!proved.has(n)) errors.push(`response/data/checks.json: the ${kind} branch cannot be proved without the ${n} check`);

    if (gateFailed && !checks.findings.some((f) => f.code === 'INTEGRATION_GATE_FAILED')) errors.push('response/data/checks.json: a failed delivery gate records the INTEGRATION_GATE_FAILED finding, so the receipt names the gate that failed and the resolutions that were made');
    if (!gateFailed && checks.findings.some((f) => f.code === 'INTEGRATION_GATE_FAILED')) errors.push('response/data/checks.json: INTEGRATION_GATE_FAILED is recorded only when the gates-passed check actually failed');

    findingCount = checks.findings.length;
    for (const f of checks.findings) {
      if (delta && !inventoried.has(f.resourceRef)) errors.push(`response/data/checks.json: finding on ${f.resourceRef} names an uninventoried resource`);
      if (f.code === 'PORT_COORDINATION_REQUIRED') {
        if (f.port === null) errors.push('response/data/checks.json: a port coordination finding must name the port');
        if (f.holderRef === null) errors.push('response/data/checks.json: a port coordination finding must name the process that already holds the port');
        if (response.status === 'done') errors.push('response/data/checks.json: a port coordination finding cannot end in an operated outcome');
        else if (response.stop !== 'PORT_CONFLICT') errors.push('response/response.json: a port coordination finding requires the PORT_CONFLICT failure');
      }
      if (f.code === 'INTEGRATION_GATE_FAILED' && response.status === 'done') errors.push('response/data/checks.json: an integration gate failure finding cannot end in an operated outcome');
    }
    forEachString(checks, (text, at) => { if (credentialLeak(text)) errors.push(`response/data/checks.json: ${at} records a credential, which the receipt refuses`); });
  } else if (response.status === 'done') errors.push('response/data/checks.json: a done branch needs the proved check set');

  // The two route branches. A runtime attestation and an identity provisioning both act on the
  // registry entry of one project route, so the route key is not decoration: it is the resource, and
  // a branch that names none has nothing to attest or provision against.
  const routeKey = requirements.routeKey;
  if (ROUTE_KINDS.has(kind)) {
    if (empty(routeKey)) errors.push(`request.json: the ${kind} branch acts on one project route and routeKey names none`);
    else if (!ROUTE_KEY.test(String(routeKey))) errors.push(`request.json: routeKey ${routeKey} is not a <project>/<role> registry entry`);
    else {
      if (desiredResources.length && !desiredResources.includes(String(routeKey))) errors.push(`request.json: routeKey ${routeKey} is outside desiredState.resourceRefs, so the operation would act on an entry it never declared`);
      if (delta) for (const m of delta.mutations) if (m.resourceRef !== String(routeKey)) errors.push(`response/data/delta.json: the ${kind} branch mutated ${m.resourceRef}, which is not the registry entry ${routeKey} it operates`);
    }
  } else if (!empty(routeKey)) errors.push(`request.json: routeKey belongs to the runtime and identity branches; the ${kind || 'declared'} branch operates no project route`);

  // Identity: a missing record is created, not reported. A provisioning that ran publishes the
  // account record it wrote, and one that did not may not publish one; either way the record is a
  // set of names, which is what makes a password impossible to file here even by accident.
  const provisioned = Boolean(delta?.appliedEffects?.includes('provision-identity'));
  const accountFile = 'response/data/account.json';
  if (kind === 'identity') {
    if (desiredEffects.some(effect => ['provision-identity', 'seed-flow-fixtures'].includes(effect)) && empty(requirements.flow)) errors.push('request.json: the identity branch provisions for one flow and flow names none');
    errors.push(...identityRotationErrors(requirements, delta?.identityRotation));
    if (response.status === 'done' && desiredEffects.includes('rotate-admin-credential') && !delta?.identityRotation) errors.push('rotation requires its bound proof record');
    if (provisioned && !present.has('uat-account')) errors.push(`${accountFile}: provision-identity was applied, so the account record it wrote is published with it`);
    if (checks && provisioned && !checks.findings.some((f) => f.code === 'IDENTITY_PROVISIONED')) errors.push('response/data/checks.json: an identity that was provisioned records the IDENTITY_PROVISIONED finding, so the receipt names what this run created');
  }
  if (present.has('uat-account')) {
    if (kind !== 'identity') errors.push(`${accountFile}: an account record belongs to the identity branch, not to ${kind}`);
    if (!provisioned && delta) errors.push(`${accountFile}: an account record is published only by the run that provisioned it`);
    if (has(accountFile)) {
      let account = null; try { account = JSON.parse(await read(accountFile)); } catch { account = null; }
      if (account) {
        if (!empty(routeKey) && account.identity !== String(routeKey)) errors.push(`${accountFile}: the account belongs to registry entry ${account.identity}, not to ${routeKey}`);
        if (!empty(requirements.flow) && account.flow !== requirements.flow) errors.push(`${accountFile}: the record belongs to flow ${account.flow}, not to ${requirements.flow}`);
        const aliases = Object.entries(account.accounts ?? {});
        if (!aliases.length) errors.push(`${accountFile}: a flow names its actors by alias and this record carries none`);
        for (const [alias, entry] of aliases) {
          if (provisioned && entry.provisionedBy === null) errors.push(`${accountFile}: this run created ${alias}, so the record names the run that provisioned it`);
          if (account.env && !String(entry.sealed).startsWith(`.stacks/${account.env}/`)) errors.push(`${accountFile}: ${alias} is sealed in another environment than ${account.env}; an account of one environment is not an account in another`);
        }
        forEachString(account, (text, at) => { if (credentialLeak(text)) errors.push(`${accountFile}: ${at} carries a credential; the account record holds names and references only`); });
      }
    }
  }

  // Attestation reports what answered. A runtime entry may only be reported ready over evidence, and
  // the evidence is the checks the branch publishes, never the status it would like to write.
  if (kind === 'runtime' && checks && response.status === 'done') {
    for (const name of ['endpoints-served', 'head-observed']) {
      if (!requiredChecks.includes(name)) continue;
      if (!checks.checks.some((c) => c.name === name && c.status === 'passed')) errors.push(`response/data/checks.json: an attested runtime entry needs ${name} passed; a status nobody probed is an assertion`);
    }
  }
  if (ladder && delta) {
    errors.push(...runtimeLadderErrors(ladder, {
      requirements,
      sessionId: request?.sessionId ?? null,
      applied: new Set(delta.appliedEffects),
      findings: new Set((checks?.findings ?? []).map((f) => f.code)),
      gateFailed,
    }));
  }

  if (present.has('platform-operation-receipt') && has('response/response.md')) {
    const text = await read('response/response.md');
    const binding = Object.fromEntries((tableUnder(text, '## Binding') ?? []).map(([k, v]) => [k, v]));
    if (!empty(service) && binding.Service !== service) errors.push('response/response.md: Binding names a service the request did not operate');
    if (kind && binding['Service kind'] !== kind) errors.push('response/response.md: Binding names another service kind');
    if (!empty(desired.planSha256) && binding['Desired state'] !== desired.planSha256) errors.push('response/response.md: Binding carries a desired state the approval did not cover');
    if (!empty(requirements.approval) && binding.Approval !== requirements.approval) errors.push('response/response.md: Binding names an approval the request did not declare');
    const conv = Object.fromEntries((tableUnder(text, '## Convergence') ?? []).map(([k, v]) => [k, v]));
    if (delta && conv.Convergence !== delta.convergence) errors.push(`response/response.md: Convergence says ${conv.Convergence} but the delta says ${delta.convergence}`);
    const mdChecks = tableUnder(text, '## Checks') ?? [];
    if (checks && mdChecks.length !== checks.checks.length) errors.push(`response/response.md: Checks has ${mdChecks.length} rows, the proof set has ${checks.checks.length}`);
    const mdMutations = tableUnder(text, '## Mutations') ?? [];
    if (delta && mdMutations.length !== delta.mutations.length) errors.push(`response/response.md: Mutations has ${mdMutations.length} rows, the delta has ${delta.mutations.length}`);
    const mdFindings = tableUnder(text, '## Findings') ?? [];
    if (checks && mdFindings.length !== findingCount) errors.push(`response/response.md: Findings has ${mdFindings.length} rows, the proof set has ${findingCount}`);
    if (credentialLeak(text)) errors.push('response/response.md: a credential handle or secret-shaped token must never be recorded in the receipt');
  } else if (response.status === 'done') errors.push('response/response.md: a done branch needs the operation receipt');

  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validatePlatformStep(path.resolve(target), ROOT);
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid platform.operate branch\n');
}
