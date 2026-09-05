// runtime.serve's own law over one branch, on top of the shared step check: the runtime ladder's closed
// effect and per-rung proof sets; the approved plan hash and the approval that covers it — an approval
// id, or the environment's declaration by path and hash where it marks the rung's class declared; the
// route entry inventoried before it is changed and every mutation on that entry alone; port claims
// owned by this rung and never freed by mutating their holder; convergence agreeing with the mutation
// count; one server per route on one fixed port, served from one integration branch under the lease;
// the complete proof set passed before an operated outcome; and no capability handle or
// credential-shaped token anywhere.
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
import { resolutionErrors } from '../../scripts/merge-resolution.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OPERATOR = 'runtime.serve';
export const SERVICE_KIND = 'runtime';

// A completed serve merge emits `changes`: the exact Git diff of the integration merge, bound to the
// served head. quality.verify reads it through this function so the two never disagree about what a
// merge receipt must say.
export function integrationChangesErrors(delta, text, { verifyGit = true } = {}) {
  const errors = [], ladder = delta?.runtimeLadder, binding = Object.fromEntries(tableUnder(text, '## Binding') ?? []);
  if (delta?.serviceKind !== SERVICE_KIND || ladder?.rung !== 'serve' || !ladder.integration || ladder.reused || delta.convergence !== 'converged') return ['changes: only a completed serve merge emits integration changes'];
  if (binding.Operator !== OPERATOR || binding.Head !== ladder.servedHead || binding.Branch !== ladder.integration.branch) errors.push('changes: operator, head and branch must match the served integration delta');
  if (!/^[0-9a-f]{40}$/.test(binding.Base ?? '')) errors.push('changes: Base must identify the integration predecessor commit');
  if (verifyGit) try {
    const cwd = ladder.integration.worktreeRef;
    if (!path.isAbsolute(cwd)) throw new Error('integration changes require the resolved worktree path');
    const git = (args) => execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    if (git(['rev-parse', 'HEAD']) !== binding.Head || git(['branch', '--show-current']) !== binding.Branch) errors.push('changes: actual integration checkout head or branch differs');
    const parents = git(['rev-list', '--parents', '-n', '1', binding.Head]).split(' ');
    if (parents.length >= 3 ? parents[1] !== binding.Base : ladder.observed?.head !== binding.Base) errors.push('changes: Base must be the actual merge first parent or the observed fast-forward predecessor');
    if (git(['merge-base', binding.Base, binding.Head]) !== binding.Base) errors.push('changes: Base must be an ancestor of the served head');
    const actual = git(['diff', '--name-only', '--no-renames', binding.Base, binding.Head]).split('\n').filter(Boolean).sort();
    const rows = tableUnder(text, '## Files') ?? [], recorded = rows.map(([file]) => file).sort();
    if (JSON.stringify(actual) !== JSON.stringify(recorded)) errors.push('changes: Files must equal the actual merged Git diff');
  } catch { errors.push('changes: actual merged Git provenance cannot be verified'); }
  return errors;
}

// The runtime ladder publishes one closed effect set; a cross-filed effect is how an unapproved change
// acquires the appearance of authority.
export const RUNTIME_EFFECTS = ['register-runtime-entry', 'attest-runtime-entry', 'bring-up-infra-stack', 'locate-routed-checkouts', 'start-role-runtime', 'merge-into-integration-branch', 'serve-runtime-head', 'restart-runtime-server', 'reset-runtime-server', 'stop-runtime-server', 'queue-runtime-lease'];
// The join from an effect to the class of authorisation an environment declares for it. The classes,
// their defaults and the reference shape are the environment schema's.
export const EFFECT_CLASSES = { 'bring-up-infra-stack': 'stack-up', ...Object.fromEntries(RUNTIME_EFFECTS.filter((e) => e !== 'bring-up-infra-stack').map((e) => [e, 'runtime'])) };
export function operationClasses(kind, effects) {
  return { classes: [...new Set(effects.map((e) => EFFECT_CLASSES[e]).filter(Boolean))], unclassified: effects.filter((e) => !EFFECT_CLASSES[e]) };
}
// The proof set is published per rung, not per operator: a rung below the server cannot probe an
// endpoint nothing is serving yet.
const SERVER_RUNG_CHECKS = ['entry-declared', 'endpoints-served', 'head-observed', 'generation-advanced', 'integration-merged', 'server-pid-owned', 'lease-honoured'];
export const RUNG_CHECKS = {
  'stack-up': ['infra-ports-open', 'cors-origin-admitted', 'generation-advanced'],
  locate: ['checkout-located', 'head-observed', 'generation-advanced'],
  'start-role': SERVER_RUNG_CHECKS,
  serve: [...SERVER_RUNG_CHECKS, 'gates-passed'],
  restart: SERVER_RUNG_CHECKS,
  reset: SERVER_RUNG_CHECKS,
  stop: ['entry-declared', 'generation-advanced', 'server-pid-owned', 'lease-honoured'],
};
// A serve that only took a queue position merged nothing and started nothing.
export const QUEUED_CHECKS = ['entry-declared', 'generation-advanced', 'lease-honoured'];
export const RUNTIME_CHECKS = [...new Set([...Object.values(RUNG_CHECKS).flat(), ...QUEUED_CHECKS])];
export const RUNTIME_CAPABILITY = 'runtime:registry-write';
// One rung, one effect. Every rung attests on top of it; a reused or queued serve applies no rung effect.
export const RUNG_EFFECTS = { 'stack-up': 'bring-up-infra-stack', locate: 'locate-routed-checkouts', 'start-role': 'start-role-runtime', serve: 'serve-runtime-head', restart: 'restart-runtime-server', reset: 'reset-runtime-server', stop: 'stop-runtime-server' };
export const RUNGS_THAT_START = new Set(['start-role', 'serve', 'restart', 'reset']);
export const RUNG_FINDINGS = { 'stack-up': 'RUNTIME_RUNG_CLIMBED', locate: 'RUNTIME_RUNG_CLIMBED', 'start-role': 'RUNTIME_HEAD_SERVED', serve: 'RUNTIME_HEAD_SERVED', restart: 'RUNTIME_SERVER_RESTARTED', reset: 'RUNTIME_SERVER_RESET', stop: 'RUNTIME_SERVER_STOPPED' };
export const ROUTE_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

// A credential is resolved for use, never written down. Fingerprints and commit heads are legitimate
// long hex, so they are scrubbed before the unbroken-run heuristic runs.
export function credentialLeak(value) {
  if (value.includes('capability://')) return true;
  const scrubbed = value.replaceAll(/sha256:[0-9a-f]{64}/g, '').replaceAll(/\b[0-9a-f]{40}\b/g, '');
  if (/(?:token|secret|password|api[_-]?key|bearer|authorization)\s*[:=]\s*\S/i.test(scrubbed)) return true;
  return /[A-Za-z0-9+=]{32,}/.test(scrubbed);
}
export function forEachString(value, visit, at = '$') {
  if (typeof value === 'string') return visit(value, at);
  if (Array.isArray(value)) { value.forEach((item, i) => forEachString(item, visit, `${at}[${i}]`)); return; }
  if (value !== null && typeof value === 'object') for (const [k, child] of Object.entries(value)) forEachString(child, visit, `${at}.${k}`);
}
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const asList = (v) => (Array.isArray(v) ? v : []);

// The runtime ladder's own law, over the block the delta publishes. One server per route on one fixed
// port, served from one integration branch: a session gets its commit merged in and the server
// restarted on the result, or it waits behind the lease.
export function runtimeLadderErrors(ladder, { requirements, sessionId, applied, findings, gateFailed = false }) {
  const errors = [];
  const at = 'response/data/delta.json';
  const started = RUNGS_THAT_START.has(ladder.rung) && !gateFailed;
  const queued = ladder.queuePosition !== null;
  const say = (m) => errors.push(`${at}: ${m}`);

  if (ladder.operation !== ladder.rung) say(`the operation is ${ladder.operation} and the rung recorded is ${ladder.rung}; a rung is the operation it climbed`);
  if (!empty(requirements.operation) && ladder.operation !== requirements.operation) say(`the ladder climbed ${ladder.operation}, which the request did not ask for`);
  if (!empty(requirements.routeKey) && ladder.routeKey !== String(requirements.routeKey)) say(`the ladder acts on ${ladder.routeKey}, not on the requested route ${requirements.routeKey}`);
  if (!empty(requirements.commit) && ladder.wantedCommit !== String(requirements.commit)) say('the wanted commit is not the one the request named');
  if (ladder.sessionId !== null && sessionId && ladder.sessionId !== sessionId) say(`the ladder acts for session ${ladder.sessionId}, and this branch belongs to ${sessionId}`);
  if (!applied.has('attest-runtime-entry')) say('every rung attests, because a status nobody probed is an assertion');

  const rungEffect = RUNG_EFFECTS[ladder.rung];
  if (ladder.reused || queued || gateFailed) {
    if (applied.has(rungEffect)) say(`${rungEffect} was applied although the operation ${gateFailed ? 'failed its delivery gate' : ladder.reused ? 'reused the running head' : 'only took a queue position'} and started nothing`);
  } else if (!applied.has(rungEffect)) say(`the ${ladder.rung} rung applies ${rungEffect}, which this delta never applied`);

  if (ladder.rung === 'serve' && ladder.observed.containsWanted && ladder.observed.pidAlive && ladder.observed.probeAnswered && !ladder.reused && !queued) {
    say('the running head already contained the wanted commit and answered its probe, so serve reuses it rather than restarting a healthy server');
  }
  if (ladder.reused) {
    if (ladder.rung !== 'serve') say(`only serve is idempotent by head; ${ladder.rung} is asked for by name and always acts`);
    if (!ladder.observed.containsWanted) say('a reused head must be one the running server already contained');
    if (ladder.server === null || ladder.server.pid !== ladder.observed.pid) say('a reused head keeps the running process: no new pid appears');
    if (ladder.integration !== null) say('a reused head merged nothing');
  }

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

  if (started && !ladder.reused && !queued) {
    if (ladder.server === null) say(`the ${ladder.rung} rung leaves a running server, and this delta records none`);
    else {
      if (ladder.server.previousPid !== ladder.observed.pid) say('the pid replaced must be the pid the entry recorded; a rung never replaces a process it does not own');
      if (ladder.server.pid === ladder.observed.pid) say('a rung that started a server records a new pid');
      if (ladder.servedHead === null) say('a rung that started a server records the head it serves');
      const cache = ladder.server.cache ?? null;
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
  const merged = applied.has('merge-into-integration-branch');
  if (merged && ladder.integration === null) say('a merge was applied and no integration record says what was merged into what');
  if (ladder.integration !== null) {
    if (!merged) say('the integration branch was written without merge-into-integration-branch among the applied effects');
    const anyResolutions = ladder.integration.merges.some((m) => m.resolutions.length > 0);
    if (anyResolutions !== ladder.integration.conflict) say('conflict must be true exactly when a merge here recorded a resolved hunk');
    if (anyResolutions && !findings.has('INTEGRATION_RESOLVED')) say('a merge that resolved a conflicting hunk records the INTEGRATION_RESOLVED finding, so the receipt names what serve resolved on its own');
    if (!anyResolutions && findings.has('INTEGRATION_RESOLVED')) say('INTEGRATION_RESOLVED is recorded only when a merge here actually resolved a conflicting hunk');
    for (const m of ladder.integration.merges) {
      if (m.mergeCommit === null) say(`the merge of ${m.ref} records no merge commit`);
      if (m.kind === 'session' && !gateFailed && !ladder.contains.includes(m.commit)) say(`commit ${m.commit} was merged and is absent from contains, so no consumer can prove its work is served`);
      if (m.kind === 'session' && gateFailed && ladder.contains.includes(m.commit)) say(`commit ${m.commit} failed its delivery gate and the server never restarted on it, so it cannot appear in the served head's contains`);
      if (m.kind !== 'session' && m.resolutions.length) say(`the ${m.kind} merge of ${m.ref} records resolutions; only the session merge meets a conflict serve resolves`);
      // Which rule may resolve which hunk is one law, shared with the publish that merges the same
      // branch into the target branch (scripts/merge-resolution.mjs).
      for (const e of resolutionErrors(m.resolutions, { at: `the merge of ${m.ref}` })) say(e);
    }
    if (ladder.rung === 'serve' && !ladder.integration.merges.some((m) => m.kind === 'session')) say('a serve merges the asking session branch, and this integration merged none');
  }
  if (ladder.wantedCommit !== null && started && !queued && !ladder.contains.includes(ladder.wantedCommit)) say('the wanted commit is not among the commits the served head contains');
  if (ladder.servedHead !== null && ladder.contains.length === 0) say('a served head contains at least the commit that was merged into it');

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
  const expected = ladder.reused ? 'RUNTIME_HEAD_REUSED' : RUNG_FINDINGS[ladder.rung];
  if (!queued && !gateFailed && !findings.has(expected)) say(`the receipt records ${expected}, so a reader knows which rung this run climbed`);
  return errors;
}

export async function validateRuntimeStep(branchDir, root = ROOT, { hostRoot = hostRootOf(root) } = {}) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, request, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== OPERATOR) return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');

  const missing = missingStack(root, requirements.env, hostRoot);
  if (missing) errors.push(`request.json: env ${requirements.env} names ${missing}, which this installation does not have`);

  const desired = requirements.desiredState ?? {};
  const kind = String(desired.serviceKind ?? '');
  const desiredEffects = asList(desired.effects);
  const desiredResources = asList(desired.resourceRefs);
  const mutable = new Set(asList(desired.mutableResourceRefs));
  const observationOnly = new Set(asList(desired.observationOnlyResourceRefs));
  const portClaims = asList(requirements.portClaims);
  const routeKey = requirements.routeKey;

  // The route key is the resource: the registry entry this rung climbs and attests.
  if (empty(routeKey)) errors.push('request.json: the runtime ladder acts on one project route and routeKey names none');
  else if (!ROUTE_KEY.test(String(routeKey))) errors.push(`request.json: routeKey ${routeKey} is not a <project>/<role> registry entry`);
  else {
    if (desiredResources.length && !desiredResources.includes(String(routeKey))) errors.push(`request.json: routeKey ${routeKey} is outside desiredState.resourceRefs, so the rung would act on an entry it never declared`);
    if (mutable.size && !mutable.has(String(routeKey))) errors.push('request.json: the route entry must be inside desiredState.mutableResourceRefs');
  }
  errors.push(...await platformAuthorityErrors({ root, hostRoot, requirements, kind, desiredEffects, operationClasses }));
  if (kind && kind !== SERVICE_KIND) errors.push(`request.json: desiredState.serviceKind is ${kind}; this operator climbs the runtime ladder and nothing else`);
  if (new Set(desiredEffects).size !== desiredEffects.length) errors.push('request.json: desiredState.effects must not repeat an effect');
  for (const e of desiredEffects) if (!RUNTIME_EFFECTS.includes(e)) errors.push(`request.json: requested effect ${e} does not belong to the runtime ladder`);
  for (const r of mutable) if (observationOnly.has(r)) errors.push(`request.json: resource ${r} cannot be both mutable and observation-only`);
  for (const r of desiredResources) if (mutable.size && !mutable.has(r)) errors.push(`request.json: desired resource ${r} lies outside the mutable ceiling`);
  const claimedPorts = portClaims.map((c) => c.port);
  if (new Set(claimedPorts).size !== claimedPorts.length) errors.push('request.json: portClaims must not claim the same port twice');
  for (const c of portClaims) if (desiredResources.length && !desiredResources.includes(c.resourceRef)) errors.push(`request.json: port ${c.port} is claimed for ${c.resourceRef}, which this rung does not own`);
  forEachString(request?.requirements ?? {}, (text, at) => { if (credentialLeak(text)) errors.push(`request.json: ${at} carries a credential value, which cannot enter the operator contract`); });

  let delta = null;
  if (present.has('delta') && has('response/data/delta.json')) { try { delta = JSON.parse(await read('response/data/delta.json')); } catch { delta = null; } }
  let checks = null;
  if (present.has('checks') && has('response/data/checks.json')) { try { checks = JSON.parse(await read('response/data/checks.json')); } catch { checks = null; } }
  const gateFailed = Boolean(checks?.checks?.some((c) => c.name === 'gates-passed' && c.status === 'failed'));
  if (present.has('changes')) {
    if (response.status !== 'done' || gateFailed) errors.push('changes: a failed or incomplete serve cannot publish merged delivery evidence');
    try { errors.push(...integrationChangesErrors(delta, await read('response/changes.md'))); } catch { errors.push('changes: integration receipt is missing'); }
  }

  let inventoried = new Set();
  if (delta) {
    const refs = delta.inventoriedResources.map((r) => r.resourceRef);
    inventoried = new Set(refs);
    if (new Set(refs).size !== refs.length) errors.push('response/data/delta.json: inventoriedResources must not list a resource twice');
    const ports = delta.observedPortHolders.map((h) => h.port);
    if (new Set(ports).size !== ports.length) errors.push('response/data/delta.json: observedPortHolders must not list the same port twice');
    if (!empty(routeKey) && delta.serviceRef !== String(routeKey)) errors.push('response/data/delta.json: the delta operates an entry the request did not name');
    if (!empty(routeKey) && !inventoried.has(String(routeKey))) errors.push(`response/data/delta.json: entry ${routeKey} was not inventoried before the rung`);
    if (delta.serviceKind !== SERVICE_KIND) errors.push(`response/data/delta.json: the delta names the ${delta.serviceKind} kind, not ${SERVICE_KIND}`);
    for (const r of delta.inventoriedResources) if (r.kind !== SERVICE_KIND) errors.push(`response/data/delta.json: resource ${r.resourceRef} belongs to the ${r.kind} kind and is outside the runtime ladder`);
    for (const r of desiredResources) if (!inventoried.has(r)) errors.push(`response/data/delta.json: desired resource ${r} is absent from the bound inventory`);
    if (!empty(requirements.approval) && delta.approvalRef !== requirements.approval) errors.push('response/data/delta.json: the bound approval is not the one the request declared');
    if (!empty(desired.planSha256) && delta.planSha256 !== desired.planSha256) errors.push('response/data/delta.json: planSha256 must equal the approved plan hash');
    for (const e of delta.allowedEffects) if (!RUNTIME_EFFECTS.includes(e)) errors.push(`response/data/delta.json: approved effect ${e} does not belong to the runtime ladder`);
    for (const e of desiredEffects) if (!delta.allowedEffects.includes(e)) errors.push(`response/data/delta.json: requested effect ${e} is outside the approved effect set`);

    const held = delta.capabilities.map((c) => c.capability);
    if (new Set(held).size !== held.length) errors.push('response/data/delta.json: capabilities must not repeat a capability');
    for (const c of held) if (c !== RUNTIME_CAPABILITY) errors.push(`response/data/delta.json: capability ${c} is not used by the runtime ladder`);
    if (!held.includes(RUNTIME_CAPABILITY)) errors.push(`response/data/delta.json: the runtime ladder requires the ${RUNTIME_CAPABILITY} capability`);

    const portHolderRefs = new Set(delta.observedPortHolders.map((h) => h.holderRef));
    const applied = new Set(delta.appliedEffects);
    for (const effect of applied) {
      if (!desiredEffects.includes(effect)) errors.push(`response/data/delta.json: applied effect ${effect} is outside the requested effect set`);
      if (!delta.allowedEffects.includes(effect)) errors.push(`response/data/delta.json: applied effect ${effect} is outside the approved effect set`);
    }
    const mutatedEffects = new Set();
    for (const m of delta.mutations) {
      if (!RUNTIME_EFFECTS.includes(m.effect)) errors.push(`response/data/delta.json: effect ${m.effect} does not belong to the runtime ladder`);
      if (!applied.has(m.effect)) errors.push(`response/data/delta.json: mutation effect ${m.effect} is absent from appliedEffects`);
      mutatedEffects.add(m.effect);
      if (!inventoried.has(m.resourceRef)) errors.push(`response/data/delta.json: resource ${m.resourceRef} was mutated without being inventoried first`);
      if (portHolderRefs.has(m.resourceRef)) errors.push(`response/data/delta.json: resource ${m.resourceRef} holds a claimed port and must never be mutated to free it`);
      if (delta.mutableResourceRefs.length && !delta.mutableResourceRefs.includes(m.resourceRef)) errors.push(`response/data/delta.json: resource ${m.resourceRef} was mutated outside the mutable ceiling`);
      if (!empty(routeKey) && m.resourceRef !== String(routeKey)) errors.push(`response/data/delta.json: the rung mutated ${m.resourceRef}, which is not the registry entry ${routeKey} it climbs`);
    }
    for (const e of applied) if (!mutatedEffects.has(e)) errors.push(`response/data/delta.json: applied effect ${e} records no mutation`);
    if (delta.convergence === 'already-converged' && delta.mutations.length > 0) errors.push('response/data/delta.json: an already-converged operation cannot report a mutation');
    if (delta.convergence === 'converged' && delta.mutations.length === 0) errors.push('response/data/delta.json: a converged operation must report the mutation that converged it');
    if (!delta.runtimeLadder) errors.push('response/data/delta.json: every rung records the runtimeLadder it climbed, and this delta carries none');
    forEachString(delta, (text, at) => { if (credentialLeak(text)) errors.push(`response/data/delta.json: ${at} records a credential, which the receipt refuses`); });
  } else if (response.status === 'done') errors.push('response/data/delta.json: a done branch needs the derived and applied delta');

  const ladder = delta?.runtimeLadder ?? null;
  const queuedServe = Boolean(ladder && ladder.queuePosition !== null);
  const requiredChecks = ladder ? (queuedServe ? QUEUED_CHECKS : (RUNG_CHECKS[ladder.rung] ?? [])) : [];

  let findingCount = 0;
  if (checks) {
    if (!empty(routeKey) && checks.serviceRef !== String(routeKey)) errors.push('response/data/checks.json: the proof set names an entry the request did not climb');
    if (checks.serviceKind !== SERVICE_KIND) errors.push('response/data/checks.json: the proof set names another service kind');
    const requested = new Set(checks.requiredCheckNames);
    for (const n of requiredChecks) if (!requested.has(n)) errors.push(`response/data/checks.json: the ${ladder?.rung ?? 'runtime'} rung must require the ${n} check`);
    for (const n of requested) if (!RUNTIME_CHECKS.includes(n)) errors.push(`response/data/checks.json: check ${n} does not belong to the runtime ladder`);
    const seen = new Set();
    const proved = new Set();
    for (const c of checks.checks) {
      const key = `${c.name}|${c.resourceRef}`;
      if (seen.has(key)) errors.push(`response/data/checks.json: check ${c.name} is recorded twice for ${c.resourceRef}`);
      seen.add(key);
      if (delta && !inventoried.has(c.resourceRef)) errors.push(`response/data/checks.json: check ${c.name} names uninventoried resource ${c.resourceRef}`);
      if (c.status === 'passed') proved.add(c.name);
      else if (response.status === 'done') errors.push(`response/data/checks.json: check ${c.name} failed, so the rung cannot be reported as climbed`);
      if (c.name === 'gates-passed' && c.status === 'failed') {
        if (response.status === 'done') errors.push('response/data/checks.json: a failed delivery gate cannot end in an operated outcome');
        else if (response.stop !== 'INTEGRATION_FAILED') errors.push('response/response.json: a failed delivery gate requires the INTEGRATION_FAILED stop');
      }
    }
    if (response.status === 'done') for (const n of requiredChecks) if (!proved.has(n)) errors.push(`response/data/checks.json: the ${ladder?.rung ?? 'runtime'} rung cannot be proved without the ${n} check`);
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
      if (f.code === 'IDENTITY_PROVISIONED') errors.push('response/data/checks.json: IDENTITY_PROVISIONED belongs to identity.provision; the runtime ladder creates no account');
    }
    forEachString(checks, (text, at) => { if (credentialLeak(text)) errors.push(`response/data/checks.json: ${at} records a credential, which the receipt refuses`); });
  } else if (response.status === 'done') errors.push('response/data/checks.json: a done branch needs the proved check set');

  // Attestation reports what answered: an entry is ready only over the checks the rung publishes.
  if (checks && response.status === 'done') {
    for (const name of ['endpoints-served', 'head-observed']) {
      if (!requiredChecks.includes(name)) continue;
      if (!checks.checks.some((c) => c.name === name && c.status === 'passed')) errors.push(`response/data/checks.json: an attested runtime entry needs ${name} passed; a status nobody probed is an assertion`);
    }
  }
  if (ladder && delta) {
    errors.push(...runtimeLadderErrors(ladder, { requirements, sessionId: request?.sessionId ?? null, applied: new Set(delta.appliedEffects), findings: new Set((checks?.findings ?? []).map((f) => f.code)), gateFailed }));
  }

  if (present.has('platform-operation-receipt') && has('response/response.md')) {
    const text = await read('response/response.md');
    const binding = Object.fromEntries((tableUnder(text, '## Binding') ?? []).map(([k, v]) => [k, v]));
    if (binding.Operator !== OPERATOR) errors.push(`response/response.md: Binding names operator ${binding.Operator}; this receipt is written by ${OPERATOR}`);
    if (!empty(routeKey) && binding.Service !== String(routeKey)) errors.push('response/response.md: Binding names an entry the request did not climb');
    if (binding['Service kind'] !== SERVICE_KIND) errors.push('response/response.md: Binding names another service kind');
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
  const { errors } = await validateRuntimeStep(path.resolve(target), ROOT);
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write(`valid ${OPERATOR} branch\n`);
}
