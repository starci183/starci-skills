// platform.operate's own law over one branch, on top of the shared step check: the branch's closed
// effect, proof and capability sets; the approved plan hash and the approval that covers it; every
// desired resource inventoried under the same kind and inside the mutable ceiling; port claims owned
// by this operation and never freed by mutating their holder; every mutation inventoried first and
// inside the approved set; convergence agreeing with the mutation count; the complete proof set
// passed before an operated outcome; and no capability handle or credential-shaped token anywhere.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { missingStack } from '../../scripts/validate-request.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// The three service kinds are branches of one job. Each publishes its own closed effect set, its own
// required proof set, and the exact capabilities it needs; a cross-filed effect is how an unapproved
// change acquires the appearance of authority.
export const KIND_EFFECTS = {
  observability: ['update-config', 'restart-service', 'upsert-dashboard', 'update-remote-write'],
  sonar: ['create-project', 'assign-profile', 'assign-gate', 'enforce-setting'],
  tunnel: ['create-tunnel', 'update-tunnel-route', 'upsert-proxied-dns'],
  runtime: ['register-runtime-entry', 'attest-runtime-entry'],
  identity: ['provision-identity', 'seed-flow-fixtures'],
};
export const KIND_CHECKS = {
  observability: ['service-health', 'target-boundary', 'label-boundary', 'remote-write-delivery', 'sample-ordering', 'retry-backoff', 'sensitive-data-filter'],
  sonar: ['service-available', 'project-exists', 'source-revision', 'profile-assigned', 'gate-assigned', 'enforcement-active'],
  tunnel: ['dns-target', 'tunnel-route', 'tls', 'public-https'],
  runtime: ['entry-declared', 'endpoints-served', 'head-observed', 'generation-advanced'],
  identity: ['provider-reachable', 'credential-resolvable', 'account-exists', 'account-signs-in', 'no-credential-recorded'],
};
export const KIND_CAPABILITIES = {
  observability: ['metrics:remote-write'],
  sonar: ['sonar:project-admin'],
  tunnel: ['tunnel:write', 'dns:write'],
  runtime: ['runtime:registry-write'],
  identity: ['identity:account-admin'],
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

export async function validatePlatformStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, request, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'platform.operate') return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');

  // An env names a stack of this installation; the vocabulary is the folder, not a list kept here.
  const missing = missingStack(root, requirements.env);
  if (missing) errors.push(`request.json: env ${requirements.env} names ${missing}, which this installation does not have`);

  const desired = requirements.desiredState ?? {};
  const kind = String(desired.serviceKind ?? '');
  const desiredEffects = asList(desired.effects);
  const desiredResources = asList(desired.resourceRefs);
  const mutable = new Set(asList(desired.mutableResourceRefs));
  const observationOnly = new Set(asList(desired.observationOnlyResourceRefs));
  const portClaims = asList(requirements.portClaims);
  const service = requirements.service;

  if (empty(requirements.approval)) errors.push('request.json: approval has no default; changing a shared runtime is never something an agent decides alone');
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

  let findingCount = 0;
  if (checks) {
    if (!empty(service) && checks.serviceRef !== service) errors.push('response/data/checks.json: the proof set names a service the request did not operate');
    if (kind && checks.serviceKind !== kind) errors.push('response/data/checks.json: the proof set names another service kind');
    // The required proof set is the whole set the branch publishes; the caller cannot ask for less.
    const requested = new Set(checks.requiredCheckNames);
    for (const n of KIND_CHECKS[kind] ?? []) if (!requested.has(n)) errors.push(`response/data/checks.json: the ${kind} branch must require the ${n} check`);
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
    }
    if (response.status === 'done') for (const n of KIND_CHECKS[kind] ?? []) if (!proved.has(n)) errors.push(`response/data/checks.json: the ${kind} branch cannot be proved without the ${n} check`);

    findingCount = checks.findings.length;
    for (const f of checks.findings) {
      if (delta && !inventoried.has(f.resourceRef)) errors.push(`response/data/checks.json: finding on ${f.resourceRef} names an uninventoried resource`);
      if (f.code !== 'PORT_COORDINATION_REQUIRED') continue;
      if (f.port === null) errors.push('response/data/checks.json: a port coordination finding must name the port');
      if (f.holderRef === null) errors.push('response/data/checks.json: a port coordination finding must name the process that already holds the port');
      if (response.status === 'done') errors.push('response/data/checks.json: a port coordination finding cannot end in an operated outcome');
      else if (response.stop !== 'PORT_CONFLICT') errors.push('response/response.json: a port coordination finding requires the PORT_CONFLICT failure');
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
    if (empty(requirements.flow)) errors.push('request.json: the identity branch provisions for one flow and flow names none');
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
      if (!checks.checks.some((c) => c.name === name && c.status === 'passed')) errors.push(`response/data/checks.json: an attested runtime entry needs ${name} passed; a status nobody probed is an assertion`);
    }
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
  const { errors } = await validatePlatformStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid platform.operate branch\n');
}
