// identity.provision's own law over one branch, on top of the shared step check: the identity kind's
// closed effect, proof and capability sets; the approved plan hash and the approval that covers it — an
// approval id, or the environment's declaration by path and hash where it marks identity provisioning
// declared; every mutation on the route's entry alone; a provisioning that ran publishes the account
// record it wrote and that record is a set of names; a rotation is bound to one principal and proves
// the new credential works and the old one fails; the complete proof set passed before a provisioned
// outcome; and no capability handle or credential-shaped token anywhere.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { hostRootOf, missingStack } from '../../scripts/validate-request.mjs';
import { platformAuthorityErrors } from '../../scripts/platform-authority.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OPERATOR = 'identity.provision';
export const SERVICE_KIND = 'identity';

// The identity kind publishes its closed effect set, its proof set and the one capability it needs.
export const IDENTITY_EFFECTS = ['provision-identity', 'rotate-admin-credential'];
export const IDENTITY_CHECKS = ['provider-reachable', 'credential-resolvable', 'account-exists', 'account-signs-in', 'no-credential-recorded'];
export const KIND_CAPABILITIES = { identity: ['identity:account-admin'] };
// The join from an effect to the class of authorisation an environment declares for it. Rotation
// belongs to no class, so its approval is always an id.
export const EFFECT_CLASSES = { 'provision-identity': 'identity-provisioning' };
export function operationClasses(kind, effects) {
  return { classes: [...new Set(effects.map((e) => EFFECT_CLASSES[e]).filter(Boolean))], unclassified: effects.filter((e) => !EFFECT_CLASSES[e]) };
}
// A check that fails because the dependency is not there at all is PROVISIONING_UNAVAILABLE; one that
// fails on an account or credential that exists but does not prove itself is IDENTITY_UNPROVEN.
const UNAVAILABLE_CHECKS = new Set(['provider-reachable', 'credential-resolvable']);
export const ROUTE_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

// One branch provisions a flow's whole cast. `request/identity-plan.json` is where that cast is
// declared (resources/identity-plan.schema.json#accounts, whose alias is the key both sides join on)
// and the published account record is what the branch left behind: the two must name the same aliases,
// each with the username the plan asked for. A branch with no plan file on disk is a rotation or a
// blocked run and this says nothing about it.
export async function planCastErrors(branchDir, aliases, accountFile) {
  const errors = [];
  const planFile = path.join(branchDir, 'request', 'identity-plan.json');
  if (!existsSync(planFile)) return errors;
  let plan = null; try { plan = JSON.parse(await readFile(planFile, 'utf8')); } catch { return errors; }
  const planned = Array.isArray(plan?.accounts) ? plan.accounts : null;
  if (!planned) return errors;
  const published = new Map(aliases);
  for (const account of planned) {
    const entry = published.get(account.alias);
    if (!entry) { errors.push(`${accountFile}: the plan provisions ${account.alias} and the record publishes no such alias; one branch provisions every alias the flow names`); continue; }
    if (entry.username !== account.username) errors.push(`${accountFile}: ${account.alias} is ${entry.username} here and ${account.username} in the plan`);
  }
  const names = new Set(planned.map((account) => account.alias));
  for (const [alias] of aliases) if (!names.has(alias)) errors.push(`${accountFile}: ${alias} is published as provisioned here and the plan does not name it`);
  return errors;
}

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

// Rotation is an explicit approval-id operation, not a non-production provisioning default. Its
// provider, principal and complete protected write set are frozen by the request.
export function identityRotationErrors(requirements, rotation) {
  const errors = [];
  const requested = requirements.desiredState?.effects?.includes('rotate-admin-credential');
  const bound = requirements.identityRotation;
  if (!requested) { if (bound || rotation) errors.push('identityRotation requires the rotation effect'); return errors; }
  if (requirements.desiredState.effects.length !== 1) errors.push('rotation cannot combine other identity effects');
  if (!bound || !bound.provider || !bound.realm || !bound.credentialName || !/^sha256:[a-f0-9]{64}$/.test(bound.principalFingerprint ?? '') || !Array.isArray(bound.custodyRefs) || !bound.custodyRefs.length) errors.push('rotation requires exact provider, principal and protected custody');
  else {
    if (Object.keys(bound).some((k) => !['provider', 'realm', 'credentialName', 'principalFingerprint', 'custodyRefs', 'stagingRefs'].includes(k))) errors.push('rotation binding contains unknown fields');
    if (!/^https?:\/\/[^\s]+$/.test(bound.provider) || !/^[a-zA-Z0-9._-]+$/.test(bound.realm)) errors.push('rotation provider or realm invalid');
    if (new Set(bound.custodyRefs).size !== bound.custodyRefs.length || bound.custodyRefs.some((ref) => typeof ref !== 'string' || !ref.startsWith(`.stacks/${requirements.env}/`) || ref.includes('..') || ref.includes('\\') || ref.includes('/secrets/uat'))) errors.push('rotation custody must be exact protected environment files');
    if (!Array.isArray(bound.stagingRefs) || !bound.stagingRefs.length || bound.stagingRefs.some((ref) => typeof ref !== 'string' || !ref.startsWith(`.stacks/${requirements.env}/`) || !ref.endsWith('.enc') || ref.includes('..') || ref.includes('\\') || bound.custodyRefs.includes(ref))) errors.push('rotation staging requires separately bound protected ciphertext paths');
    if (rotation) {
      for (const key of ['provider', 'realm', 'credentialName', 'principalFingerprint']) if (rotation[key] !== bound[key]) errors.push(`rotation ${key} differs from approved principal binding`);
      if (JSON.stringify([...rotation.custodyRefs].sort()) !== JSON.stringify([...bound.custodyRefs].sort())) errors.push('rotation custody differs from approved write set');
      for (const key of ['newCredentialWorks', 'oldCredentialRejected', 'sessionsInvalidated', 'custodyConsistent']) if (rotation[key] !== true) errors.push(`rotation requires ${key} proof`);
    }
  }
  return errors;
}

export async function validateIdentityStep(branchDir, root = ROOT, { hostRoot = hostRootOf(root) } = {}) {
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
  const routeKey = requirements.routeKey;
  const rotating = desiredEffects.includes('rotate-admin-credential');
  const provisioning = desiredEffects.includes('provision-identity');

  if (empty(routeKey)) errors.push('request.json: the identity is created at the provider one project route declares and routeKey names none');
  else if (!ROUTE_KEY.test(String(routeKey))) errors.push(`request.json: routeKey ${routeKey} is not a <project>/<role> registry entry`);
  else {
    if (desiredResources.length && !desiredResources.includes(String(routeKey))) errors.push(`request.json: routeKey ${routeKey} is outside desiredState.resourceRefs, so the operation would act on an entry it never declared`);
    if (mutable.size && !mutable.has(String(routeKey))) errors.push('request.json: the route entry must be inside desiredState.mutableResourceRefs');
  }
  errors.push(...await platformAuthorityErrors({ root, hostRoot, requirements, kind, desiredEffects, operationClasses }));
  if (kind && kind !== SERVICE_KIND) errors.push(`request.json: desiredState.serviceKind is ${kind}; this operator provisions identity and nothing else`);
  if (new Set(desiredEffects).size !== desiredEffects.length) errors.push('request.json: desiredState.effects must not repeat an effect');
  for (const e of desiredEffects) if (!IDENTITY_EFFECTS.includes(e)) errors.push(`request.json: requested effect ${e} does not belong to identity provisioning${e === 'seed-flow-fixtures' ? '; a seed is placed by data.seed' : ''}`);
  if (provisioning && empty(requirements.flow)) errors.push('request.json: provisioning creates one flow\'s accounts and flow names none');
  if (rotating && !empty(requirements.flow)) errors.push('request.json: a rotation runs alone and provisions no flow; flow must be null');
  for (const r of mutable) if (observationOnly.has(r)) errors.push(`request.json: resource ${r} cannot be both mutable and observation-only`);
  for (const r of desiredResources) if (mutable.size && !mutable.has(r)) errors.push(`request.json: desired resource ${r} lies outside the mutable ceiling`);
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
    if (!empty(routeKey) && delta.serviceRef !== String(routeKey)) errors.push('response/data/delta.json: the delta operates an entry the request did not name');
    if (!empty(routeKey) && !inventoried.has(String(routeKey))) errors.push(`response/data/delta.json: entry ${routeKey} was not inventoried before the operation`);
    if (delta.serviceKind !== SERVICE_KIND) errors.push(`response/data/delta.json: the delta names the ${delta.serviceKind} kind, not ${SERVICE_KIND}`);
    for (const r of delta.inventoriedResources) if (r.kind !== SERVICE_KIND) errors.push(`response/data/delta.json: resource ${r.resourceRef} belongs to the ${r.kind} kind and is outside identity provisioning`);
    if (delta.runtimeLadder) errors.push('response/data/delta.json: runtimeLadder belongs to runtime.serve; identity provisioning climbs no rung');
    if (!empty(requirements.approval) && delta.approvalRef !== requirements.approval) errors.push('response/data/delta.json: the bound approval is not the one the request declared');
    if (!empty(desired.planSha256) && delta.planSha256 !== desired.planSha256) errors.push('response/data/delta.json: planSha256 must equal the approved plan hash');
    for (const e of delta.allowedEffects) if (!IDENTITY_EFFECTS.includes(e)) errors.push(`response/data/delta.json: approved effect ${e} does not belong to identity provisioning`);
    for (const e of desiredEffects) if (!delta.allowedEffects.includes(e)) errors.push(`response/data/delta.json: requested effect ${e} is outside the approved effect set`);
    const held = delta.capabilities.map((c) => c.capability);
    if (new Set(held).size !== held.length) errors.push('response/data/delta.json: capabilities must not repeat a capability');
    for (const c of held) if (!KIND_CAPABILITIES.identity.includes(c)) errors.push(`response/data/delta.json: capability ${c} is not used by identity provisioning`);
    for (const c of KIND_CAPABILITIES.identity) if (!held.includes(c)) errors.push(`response/data/delta.json: identity provisioning requires the ${c} capability`);
    const applied = new Set(delta.appliedEffects);
    for (const effect of applied) {
      if (!desiredEffects.includes(effect)) errors.push(`response/data/delta.json: applied effect ${effect} is outside the requested effect set`);
      if (!delta.allowedEffects.includes(effect)) errors.push(`response/data/delta.json: applied effect ${effect} is outside the approved effect set`);
    }
    const mutatedEffects = new Set();
    for (const m of delta.mutations) {
      if (!IDENTITY_EFFECTS.includes(m.effect)) errors.push(`response/data/delta.json: effect ${m.effect} does not belong to identity provisioning`);
      if (!applied.has(m.effect)) errors.push(`response/data/delta.json: mutation effect ${m.effect} is absent from appliedEffects`);
      mutatedEffects.add(m.effect);
      if (!inventoried.has(m.resourceRef)) errors.push(`response/data/delta.json: resource ${m.resourceRef} was mutated without being inventoried first`);
      if (!empty(routeKey) && m.resourceRef !== String(routeKey)) errors.push(`response/data/delta.json: provisioning mutated ${m.resourceRef}, which is not the registry entry ${routeKey} it acts on`);
    }
    for (const e of applied) if (!mutatedEffects.has(e)) errors.push(`response/data/delta.json: applied effect ${e} records no mutation`);
    if (delta.convergence === 'already-converged' && delta.mutations.length > 0) errors.push('response/data/delta.json: an already-converged operation cannot report a mutation');
    if (delta.convergence === 'converged' && delta.mutations.length === 0) errors.push('response/data/delta.json: a converged operation must report the mutation that converged it');
    forEachString(delta, (text, at) => { if (credentialLeak(text)) errors.push(`response/data/delta.json: ${at} records a credential, which the receipt refuses`); });
  } else if (response.status === 'done') errors.push('response/data/delta.json: a done branch needs the derived and applied delta');

  // Rotation: bound to one principal, proved on both credentials, and never combined with a flow.
  errors.push(...identityRotationErrors(requirements, delta?.identityRotation));
  if (response.status === 'done' && rotating && !delta?.identityRotation) errors.push('rotation requires its bound proof record');

  let findingCount = 0;
  if (checks) {
    if (!empty(routeKey) && checks.serviceRef !== String(routeKey)) errors.push('response/data/checks.json: the proof set names an entry the request did not act on');
    if (checks.serviceKind !== SERVICE_KIND) errors.push('response/data/checks.json: the proof set names another service kind');
    const requested = new Set(checks.requiredCheckNames);
    for (const n of IDENTITY_CHECKS) if (!requested.has(n)) errors.push(`response/data/checks.json: identity provisioning must require the ${n} check`);
    for (const n of requested) if (!IDENTITY_CHECKS.includes(n)) errors.push(`response/data/checks.json: check ${n} does not belong to identity provisioning`);
    const seen = new Set();
    const proved = new Set();
    const failed = [];
    for (const c of checks.checks) {
      const key = `${c.name}|${c.resourceRef}`;
      if (seen.has(key)) errors.push(`response/data/checks.json: check ${c.name} is recorded twice for ${c.resourceRef}`);
      seen.add(key);
      if (delta && !inventoried.has(c.resourceRef)) errors.push(`response/data/checks.json: check ${c.name} names uninventoried resource ${c.resourceRef}`);
      if (c.status === 'passed') proved.add(c.name);
      else { failed.push(c.name); if (response.status === 'done') errors.push(`response/data/checks.json: check ${c.name} failed, so the identity cannot be reported as provisioned`); }
    }
    if (response.status === 'done') for (const n of IDENTITY_CHECKS) if (!proved.has(n)) errors.push(`response/data/checks.json: identity provisioning cannot be proved without the ${n} check`);
    // A failed check names its stop: a dependency that is not there is PROVISIONING_UNAVAILABLE, an
    // account or credential that does not prove itself is IDENTITY_UNPROVEN.
    if (response.status === 'blocked' && failed.length) {
      const expected = failed.every((n) => UNAVAILABLE_CHECKS.has(n)) ? 'PROVISIONING_UNAVAILABLE' : 'IDENTITY_UNPROVEN';
      if (response.stop !== expected) errors.push(`response/response.json: check ${failed.join(', ')} failed, which stops with ${expected}, not ${response.stop}`);
    }
    findingCount = checks.findings.length;
    for (const f of checks.findings) {
      if (delta && !inventoried.has(f.resourceRef)) errors.push(`response/data/checks.json: finding on ${f.resourceRef} names an uninventoried resource`);
      if (/^RUNTIME_|^INTEGRATION_|^PORT_/.test(f.code)) errors.push(`response/data/checks.json: finding ${f.code} belongs to runtime.serve; identity provisioning climbs no rung`);
    }
    forEachString(checks, (text, at) => { if (credentialLeak(text)) errors.push(`response/data/checks.json: ${at} records a credential, which the receipt refuses`); });
  } else if (response.status === 'done') errors.push('response/data/checks.json: a done branch needs the proved check set');

  // A missing record is created, not reported. A provisioning that ran publishes the account record
  // it wrote, and one that did not may not publish one; either way the record is a set of names.
  const provisioned = Boolean(delta?.appliedEffects?.includes('provision-identity'));
  const accountFile = 'response/data/account.json';
  if (provisioned && response.status === 'done' && !present.has('uat-account')) errors.push(`${accountFile}: provision-identity was applied, so the account record it wrote is published with it`);
  if (checks && provisioned && !checks.findings.some((f) => f.code === 'IDENTITY_PROVISIONED')) errors.push('response/data/checks.json: an identity that was provisioned records the IDENTITY_PROVISIONED finding, so the receipt names what this run created');
  if (present.has('uat-account')) {
    if (!provisioned && delta) errors.push(`${accountFile}: an account record is published only by the run that provisioned it`);
    if (rotating) errors.push(`${accountFile}: a rotation creates no account and publishes no record`);
    if (has(accountFile)) {
      let account = null; try { account = JSON.parse(await read(accountFile)); } catch { account = null; }
      if (account) {
        if (!empty(routeKey) && account.identity !== String(routeKey)) errors.push(`${accountFile}: the account belongs to registry entry ${account.identity}, not to ${routeKey}`);
        if (!empty(requirements.flow) && account.flow !== requirements.flow) errors.push(`${accountFile}: the record belongs to flow ${account.flow}, not to ${requirements.flow}`);
        if (!empty(requirements.env) && account.env !== requirements.env) errors.push(`${accountFile}: the record belongs to environment ${account.env}, not to ${requirements.env}; an account of one environment is not an account in another`);
        const aliases = Object.entries(account.accounts ?? {});
        if (!aliases.length) errors.push(`${accountFile}: a flow names its actors by alias and this record carries none`);
        // The plan is the branch's whole cast, and the record is what it left: a plan that lists N
        // aliases and a record that publishes fewer is a flow whose other actors nobody created and
        // no second branch is coming for (resources/identity-plan.schema.json#accounts).
        errors.push(...await planCastErrors(branchDir, aliases, accountFile));
        for (const [alias, entry] of aliases) {
          if (provisioned && entry.provisionedBy === null) errors.push(`${accountFile}: this run created ${alias}, so the record names the run that provisioned it`);
          if (account.env && !String(entry.sealed).startsWith(`.stacks/${account.env}/`)) errors.push(`${accountFile}: ${alias} is sealed in another environment than ${account.env}; an account of one environment is not an account in another`);
        }
        forEachString(account, (text, at) => { if (credentialLeak(text)) errors.push(`${accountFile}: ${at} carries a credential; the account record holds names and references only`); });
      }
    }
  }

  if (present.has('platform-operation-receipt') && has('response/response.md')) {
    const text = await read('response/response.md');
    const binding = Object.fromEntries((tableUnder(text, '## Binding') ?? []).map(([k, v]) => [k, v]));
    if (binding.Operator !== OPERATOR) errors.push(`response/response.md: Binding names operator ${binding.Operator}; this receipt is written by ${OPERATOR}`);
    if (!empty(routeKey) && binding.Service !== String(routeKey)) errors.push('response/response.md: Binding names an entry the request did not act on');
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
  const { errors } = await validateIdentityStep(path.resolve(target), ROOT);
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write(`valid ${OPERATOR} branch\n`);
}
