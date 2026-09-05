// data.seed's own law over one branch, on top of the shared step check: the seed is authorised under
// the environment's seed class or an approval id; the receipt binds the flow, route, environment,
// operation and approval the request named; every row placed is attributed — owned by the flow's
// account, or carrying the flow's prefix, or recorded as a limitation of the store — and never a
// shared row; the rollback set is a subset of the rows placed, and a rollback removes them all;
// the four checks are proved before a placed outcome and a failed one names its stop; its data.plan
// fixture row is executable and cannot create the asserted outcome; and nothing written carries a credential.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { hostRootOf, missingStack, sessionRootOf } from '../../scripts/validate-request.mjs';
import { platformAuthorityErrors } from '../../scripts/platform-authority.mjs';
import { credentialShaped } from '../../scripts/sweep-secrets.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OPERATOR = 'data.seed';
export const RECEIPT = 'response/response.md';
export const SEED_CHECKS = ['store-reachable', 'rows-attributable', 'expected-state', 'rollback-listed'];
export const OPERATIONS = ['apply', 'rollback'];
export const ROUTE_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
// The one effect a seed applies, and the class the environment declares for it.
export const SEED_EFFECTS = ['seed-flow-fixtures'];
export const operationClasses = () => ({ classes: ['seed'], unclassified: [] });
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const unquote = (s) => String(s ?? '').trim().replace(/^`|`$/g, '');
const fields = (rows) => Object.fromEntries((rows ?? []).map(([k, v]) => [k, v]));

export async function validateSeedStep(branchDir, root = ROOT, { hostRoot = hostRootOf(root) } = {}) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, request, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== OPERATOR) return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');

  const operation = requirements.operation ?? 'apply';
  const routeKey = requirements.routeKey;
  const missing = missingStack(root, requirements.env, hostRoot);
  if (missing) errors.push(`request.json: env ${requirements.env} names ${missing}, which this installation does not have`);
  if (!empty(routeKey) && !ROUTE_KEY.test(String(routeKey))) errors.push(`request.json: routeKey ${routeKey} is not a <project>/<role> registry entry`);
  if (!OPERATIONS.includes(operation)) errors.push(`request.json: operation ${operation} is neither apply nor rollback`);
  errors.push(...await platformAuthorityErrors({ root, hostRoot, requirements, kind: 'seed', desiredEffects: SEED_EFFECTS, operationClasses }));
  for (const [key, value] of Object.entries(requirements)) if (typeof value === 'string' && credentialShaped(value)) errors.push(`request.json: requirements.${key} carries a credential-shaped value; a seed names a credential and never carries one`);

  const planRef = request?.inputs?.['seed-plan'];
  if (planRef) {
    try {
      const plan = await readFile(path.join(sessionRootOf(branchDir), planRef), 'utf8');
      const fixtureRows = tableUnder(plan, '## Fixtures') ?? [];
      const row = fixtureRows.find(([id]) => unquote(id) === requirements.flow);
      if (!row) errors.push(`request.json: seed-plan has no Fixtures row for ${requirements.flow}`);
      else {
        const [, state, action, jsonRef, , , createsOutcome] = row;
        const expectedAction = { valid: 'reuse', missing: 'create', invalid: 'update' }[state];
        if (!expectedAction || action !== expectedAction) errors.push(`request.json: seed-plan fixture ${requirements.flow} is ${state}/${action}; expected a valid reuse, missing create or invalid update classification`);
        if (!unquote(jsonRef).endsWith('.json')) errors.push(`request.json: seed-plan fixture ${requirements.flow} has no JSON execution source`);
        if (createsOutcome !== 'false') errors.push(`request.json: seed-plan fixture ${requirements.flow} creates the asserted UAT outcome`);
      }
    } catch { errors.push(`request.json: seed-plan ${planRef} cannot be read`); }
  }

  if (!(present.has('seed-receipt') && has(RECEIPT))) {
    if (response.status === 'done') errors.push(`${RECEIPT}: a done branch needs the seed receipt`);
    return { errors };
  }
  const text = await read(RECEIPT);
  if (credentialShaped(text)) errors.push(`${RECEIPT}: carries a credential-shaped value; a seed names the alias in the account record and never a credential`);
  const binding = fields(tableUnder(text, '## Binding'));
  const records = (tableUnder(text, '## Records') ?? []).map(([id, store, attribution, rollback]) => ({ id: unquote(id), store: unquote(store), attribution, rollback }));
  const checks = (tableUnder(text, '## Checks') ?? []).map(([name, status, evidence]) => ({ name: unquote(name), status, evidence }));
  const findings = new Set((tableUnder(text, '## Findings') ?? []).map(([code]) => unquote(code)));

  // The receipt binds the request.
  if (unquote(binding.Operator) !== OPERATOR) errors.push(`${RECEIPT}: Binding names operator ${binding.Operator}; this receipt is written by ${OPERATOR}`);
  if (!empty(requirements.flow) && unquote(binding.Flow) !== requirements.flow) errors.push(`${RECEIPT}: Flow ${binding.Flow} differs from the request's ${requirements.flow}`);
  if (!empty(requirements.env) && unquote(binding.Environment) !== requirements.env) errors.push(`${RECEIPT}: Environment ${binding.Environment} differs from the request's ${requirements.env}; a seed of one stack is not a seed in another`);
  if (!empty(routeKey) && unquote(binding.Route) !== String(routeKey)) errors.push(`${RECEIPT}: Route ${binding.Route} differs from the request's ${routeKey}`);
  if (unquote(binding.Operation) !== operation) errors.push(`${RECEIPT}: Operation ${binding.Operation} differs from the request's ${operation}`);
  if (!empty(requirements.approval) && unquote(binding.Approval) !== requirements.approval) errors.push(`${RECEIPT}: Binding names an approval the request did not declare`);
  const namespace = unquote(binding.Namespace);
  if (!/^uat-[A-Za-z0-9._-]+$/.test(namespace)) errors.push(`${RECEIPT}: Namespace ${namespace} is not a uat- prefix; every row the seed places under a prefix carries it`);
  else if (!empty(requirements.flow) && !namespace.startsWith(`uat-${requirements.flow}`)) errors.push(`${RECEIPT}: Namespace ${namespace} does not carry the flow ${requirements.flow}; the prefix is the flow's, so a row can be told from another flow's`);
  if (!/^sha256:[0-9a-f]{64}$/.test(unquote(binding['Seed fingerprint']))) errors.push(`${RECEIPT}: Seed fingerprint is not a sha256 digest; the snapshot freezes it to tell whether the seed changed`);
  const drafted = unquote(binding.Drafted);
  if (drafted !== 'no') errors.push(`${RECEIPT}: Drafted must be no; data.plan owns the seed plan and data.seed only executes it`);
  if (findings.has('SEED_DRAFTED')) errors.push(`${RECEIPT}: SEED_DRAFTED is forbidden; create is the planned effect for a missing fixture, not a new plan`);
  const account = unquote(binding.Account);
  if (!/^uat-[A-Za-z0-9._-]+$/.test(account)) errors.push(`${RECEIPT}: Account ${account} is not a provisioned uat- username; the rows are owned by the flow's account`);

  // Every row is attributable, or the store is a recorded limitation; a rollback set is a subset.
  const ids = new Set();
  let limitation = false;
  for (const r of records) {
    if (ids.has(r.id)) errors.push(`${RECEIPT}: record ${r.id} is listed twice`);
    ids.add(r.id);
    if (r.attribution === 'prefix' && !r.id.startsWith(namespace)) errors.push(`${RECEIPT}: record ${r.id} is attributed by prefix and does not carry the namespace ${namespace}; a prefix that is not in the identifier attributes nothing`);
    if (r.attribution === 'limitation') { limitation = true; if (r.rollback !== 'yes') errors.push(`${RECEIPT}: record ${r.id} is a limitation of the store and is not in the rollback set; a row nobody can tell apart later is removed by the seed that placed it`); }
  }
  if (limitation && !findings.has('SEED_LIMITATION')) errors.push(`${RECEIPT}: a record is attributed as a limitation and the receipt does not record SEED_LIMITATION`);
  if (!limitation && findings.has('SEED_LIMITATION')) errors.push(`${RECEIPT}: SEED_LIMITATION is recorded while every record is attributed by owner or prefix`);
  if (operation === 'rollback') {
    for (const r of records) if (r.rollback !== 'yes') errors.push(`${RECEIPT}: record ${r.id} stays after a rollback; a rollback removes the rollback set and lists nothing else`);
    if (response.status === 'done' && !findings.has('SEED_ROLLED_BACK')) errors.push(`${RECEIPT}: a rollback records SEED_ROLLED_BACK, so the reader knows the rows are gone`);
  } else if (findings.has('SEED_ROLLED_BACK')) errors.push(`${RECEIPT}: SEED_ROLLED_BACK is recorded under operation apply`);
  if (operation === 'apply' && response.status === 'done' && !records.length) errors.push(`${RECEIPT}: a placed seed lists the rows it placed, and this receipt lists none`);

  // A shared row stops before anything is written.
  if (findings.has('SHARED_ROW_REFUSED')) {
    if (response.status !== 'blocked' || response.stop !== 'SEED_SHARED_ROW') errors.push(`${RECEIPT}: SHARED_ROW_REFUSED is recorded, which stops the branch with SEED_SHARED_ROW before anything is written`);
  } else if (response.stop === 'SEED_SHARED_ROW') errors.push(`${RECEIPT}: the branch stopped on SEED_SHARED_ROW and the receipt does not record SHARED_ROW_REFUSED, so the reader cannot see which row was refused`);

  // The four checks, and the stop a failed one names.
  const seen = new Map(checks.map((c) => [c.name, c]));
  for (const c of checks) if (!SEED_CHECKS.includes(c.name)) errors.push(`${RECEIPT}: check ${c.name} is not one a seed proves`);
  if (response.status === 'done') for (const n of SEED_CHECKS) { const c = seen.get(n); if (!c) errors.push(`${RECEIPT}: a placed seed cannot be proved without the ${n} check`); else if (c.status !== 'passed') errors.push(`${RECEIPT}: check ${n} failed, so the seed cannot be reported as placed`); }
  const failed = checks.filter((c) => c.status === 'failed').map((c) => c.name);
  if (response.status === 'blocked' && failed.length && response.stop !== 'SEED_SHARED_ROW') {
    const expected = failed.every((n) => n === 'store-reachable') ? 'PROVISIONING_UNAVAILABLE' : 'SEED_UNPROVEN';
    if (response.stop !== expected) errors.push(`response/response.json: check ${failed.join(', ')} failed, which stops with ${expected}, not ${response.stop}`);
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateSeedStep(path.resolve(target), ROOT);
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write(`valid ${OPERATOR} branch\n`);
}
