// service.operate's own law over one branch, on top of the shared step check: the receipt binds
// exactly the service the environment declares — the same id, the same kind, the same environment —
// and never another; the desired state is the one the request asked for; the observed state is proved
// by the service's own declared probe and by nothing else, so an `up` that no probe answered and a
// `down` whose port is still held are the stop SERVICE_UNPROVEN and emit no receipt at all; the pid
// that answers is recorded for an `up` and no pid is claimed for a `down`; a command is run for a
// move and never for an attestation, and a move that ran none says so under its findings; a service
// the environment keeps with a person, and an approval that is not the declaration on disk for a class
// the declaration keeps with a person, are SERVICE_APPROVAL_REQUIRED before anything moved; and
// nothing written carries a credential value. The receipt's table shapes, the check vocabulary and the
// finding vocabulary live in templates/kinds/service-receipt.contract.json and are checked by the
// response gate.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { credentialShaped } from '../../scripts/sweep-secrets.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { hostRootOf, missingStack, loadEnvironmentSchema, stackDeclaration, parseDeclarationReference } from '../../scripts/validate-request.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OPERATOR = 'service.operate';
const RECEIPT = 'response/response.md';
const UNPROVEN = 'SERVICE_UNPROVEN';
const APPROVAL_REQUIRED = 'SERVICE_APPROVAL_REQUIRED';
// The operation class this operator falls under; the environment schema publishes the class list.
const CLASS = 'service';
const ALREADY = 'SERVICE_ALREADY_IN_STATE';
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const fields = (rows) => Object.fromEntries((rows ?? []).map(([k, v]) => [k, v]));

// The one service of a declaration, by id; null when the declaration names none by that name.
export const declaredService = (declaration, id) => (declaration?.services ?? []).find((s) => s.id === id) ?? null;

export async function validateServiceStep(branchDir, root = ROOT, hostRoot = hostRootOf(root)) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== OPERATOR) return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const receiptText = present.has('service-receipt') && has(RECEIPT) ? await readFile(path.join(branchDir, RECEIPT), 'utf8') : null;

  // Nothing written may look like a credential: the command's credential is resolved at the call and
  // reaches the command's own environment, never this receipt.
  for (const [label, text] of [[RECEIPT, receiptText], ['response/response.json reason', response.reason]]) {
    if (text && credentialShaped(text)) errors.push(`${label}: carries a credential-shaped value; a service receipt records an outcome, a name, a port and a pid, never the credential the declared command resolved`);
  }

  // Every stop of this operator is taken before or instead of a proved state, so none of them emits a
  // receipt: a receipt asserts a state, and a branch that stopped proved none.
  if (response.status === 'blocked') {
    if (receiptText) errors.push(`response/response.json: a ${response.stop} stop emits no ${RECEIPT}; a service receipt asserts an observed state, and a branch that stopped proved none`);
    if (response.stop === UNPROVEN) {
      const reason = String(response.reason ?? '');
      if (!reason.trim()) errors.push(`response/response.json: a ${UNPROVEN} stop carries a reason naming the service and the probe that did not answer`);
      else {
        if (/[\r\n]/.test(reason)) errors.push('response/response.json: reason spans more than one paragraph; the service, the state asked for and the probe are read together');
        if (!empty(requirements.service) && !reason.includes(String(requirements.service))) errors.push(`response/response.json: reason does not name service ${requirements.service}; a state nobody proved is named, not narrated`);
      }
    }
  }

  const env = requirements.env;
  if (!empty(env)) { const missing = missingStack(root, env, hostRoot); if (missing) errors.push(`request.json: env ${env} names no stack; ${missing} does not exist`); }

  // The declaration on disk is the authority: which services exist, what each one is, and who holds it.
  const envSchema = await loadEnvironmentSchema(root);
  const decl = empty(env) ? null : await stackDeclaration(root, env, hostRoot, envSchema);
  const valid = Boolean(decl?.exists) && decl.errors.length === 0;
  const service = valid ? declaredService(decl.declaration, requirements.service) : null;
  if (valid && !service) {
    errors.push(`request.json: service ${requirements.service} is not one the declaration ${decl.rel} carries under services (${(decl.declaration.services ?? []).map((s) => s.id).join(', ') || 'none'}); a service nobody declared is not one this operator may invent`);
  }
  if (valid && service) {
    const reference = parseDeclarationReference(envSchema, requirements.approval);
    const personHeld = service.holder === 'person';
    const classPerson = decl.authorization[CLASS] === 'person';
    const staleReference = Boolean(reference) && requirements.approval !== decl.reference;
    const why = personHeld
      ? `service ${service.id} is declared holder person`
      : classPerson && reference
        ? `the declaration marks the ${CLASS} class person and the request bound the declaration instead of an approval id`
        : staleReference
          ? `the approval names ${requirements.approval}, which is not the declaration on disk (${decl.reference})`
          : null;
    if (why && !(response.status === 'blocked' && response.stop === APPROVAL_REQUIRED)) {
      errors.push(`response/response.json: ${why}, so the branch is ${APPROVAL_REQUIRED} before anything moves; a service kept with a person is never started and then reported`);
    }
    if (!why && response.status === 'blocked' && response.stop === APPROVAL_REQUIRED) {
      errors.push(`response/response.json: ${APPROVAL_REQUIRED} while the declaration marks the ${CLASS} class ${decl.authorization[CLASS]} and service ${service.id} holder ${service.holder}; the environment answered this one`);
    }
  }

  if (!receiptText) return { errors };

  // The receipt is titled by, and binds, the one service the request named and the declaration carries.
  const title = receiptText.split(/\r?\n/)[0] ?? '';
  if (!empty(requirements.service) && title !== `# service-receipt — ${requirements.service}`) {
    errors.push(`${RECEIPT}: title names ${title.replace(/^# service-receipt — /, '')}, the request names service ${requirements.service}`);
  }
  const binding = fields(tableUnder(receiptText, '## Binding'));
  if (!empty(requirements.service) && binding.Service !== requirements.service) errors.push(`${RECEIPT}: Service ${binding.Service} differs from the request's ${requirements.service}; a receipt speaks about the one service its branch was given`);
  if (!empty(env) && binding.Environment !== env) errors.push(`${RECEIPT}: Environment ${binding.Environment} differs from the request's ${env}`);
  if (!empty(requirements.desired) && binding.Desired !== requirements.desired) errors.push(`${RECEIPT}: Desired ${binding.Desired} differs from the request's ${requirements.desired}; the desired state is what was asked for, not what was reached`);
  if (service && binding.Kind !== service.kind) errors.push(`${RECEIPT}: Kind ${binding.Kind} differs from the ${service.kind} the declaration gives service ${service.id}`);
  if (!empty(requirements.approval) && binding.Approval !== requirements.approval) errors.push(`${RECEIPT}: Approval differs from the authority the request bound`);

  // The observed state is the probe's answer, and the receipt says which of the two states it is.
  const observed = binding.Observed;
  if (!['up', 'down'].includes(observed)) { errors.push(`${RECEIPT}: Observed "${observed}" is neither up nor down; the observed state is what the declared probe answered`); return { errors }; }
  const checks = new Map((tableUnder(receiptText, '## Checks') ?? []).map(([check, status, evidence]) => [check, { status, evidence }]));
  const findings = new Set((tableUnder(receiptText, '## Findings') ?? []).map(([code]) => code));
  const passed = (id) => checks.get(id)?.status === 'passed';
  for (const [id, c] of checks) if (c.status === 'failed') errors.push(`${RECEIPT}: check ${id} is failed on a receipt; a failed check is the stop ${UNPROVEN}, never a state this receipt asserts`);
  if (!passed('service-declared')) errors.push(`${RECEIPT}: check service-declared is absent or failed; every receipt states that the declaration named this service completely`);

  if (observed === 'up') {
    if (!passed('probe-answered')) errors.push(`${RECEIPT}: Observed is up and check probe-answered is absent or failed; an up is the declared probe answering and nothing else — not an exit code, not a log line, not the fact the command was run`);
    if (!passed('holder-recorded')) errors.push(`${RECEIPT}: Observed is up and check holder-recorded is absent or failed; a process nobody recorded is a process nobody can stop`);
    if (!/^\d+$/.test(String(binding.Holder ?? ''))) errors.push(`${RECEIPT}: Holder "${binding.Holder}" is not the pid that answers; an up records the pid whose tree a later down stops`);
    if (checks.has('port-free')) errors.push(`${RECEIPT}: check port-free is recorded while Observed is up; the port is held by the service this branch proved`);
  } else {
    if (!passed('port-free')) errors.push(`${RECEIPT}: Observed is down and check port-free is absent or failed; a down is a port nothing answers on`);
    if (checks.has('probe-answered')) errors.push(`${RECEIPT}: check probe-answered is recorded while Observed is down; a probe that answered is not a service that is down`);
    if (!empty(binding.Holder)) errors.push(`${RECEIPT}: Holder ${binding.Holder} is recorded while Observed is down; a service that is down has no holder to stop`);
  }

  // Desired against observed, and what a move owes.
  const desired = requirements.desired;
  if (response.status === 'done' && ['up', 'down'].includes(desired) && observed !== desired) {
    errors.push(`response/response.json: the branch is done with Desired ${desired} and Observed ${observed}; a service that did not reach the state asked for is ${UNPROVEN}`);
  }
  if (desired === 'attested' && checks.has('command-run')) {
    errors.push(`${RECEIPT}: check command-run is recorded under desired attested; attesting reads the probe and runs nothing, because a healthy service restarted in order to be described is the state the next step was going to measure, destroyed`);
  }
  if (['up', 'down'].includes(desired) && !checks.has('command-run') && !findings.has(ALREADY)) {
    errors.push(`${RECEIPT}: no command-run check and no ${ALREADY} finding; a branch that moved a service records the command it ran, and one that moved nothing says the service already stood in the state`);
  }
  if (checks.has('command-run') && findings.has(ALREADY)) {
    errors.push(`${RECEIPT}: ${ALREADY} is recorded beside a command-run check; a service found in the desired state is a proved no-op and the declared command is not run`);
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateServiceStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid service.operate branch\n');
}
