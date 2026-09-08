// migration.release's own law over one branch, on top of the shared step check: the frozen plan, its
// environment declaration, its one target and its three producers agree with what is on disk
// (scripts/migration-release.mjs is the one home of that check); the receipt and the proof are the
// pair a done branch owes and a blocked one may not carry; the receipt's Binding restates the plan the
// request froze and its Outcome and Executions restate the proof; no image rollout, recovery or
// rollback appears; and nothing written carries a credential-shaped value.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { validateMigrationReleaseRequest, migrationReleaseProofErrors } from '../../scripts/migration-release.mjs';
import { credentialShaped } from '../../scripts/sweep-secrets.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OPERATOR = 'migration.release';
export const RECEIPT = 'response/migration-release.md';
export const PROOF = 'response/data/migration-release.json';
// scripts/migration-release.mjs#validateMigrationReleaseRequest is active only for the operator id it
// was written against; while that script still names the image operator, the plan check is asked
// again under that id when it answers inactive for this one. Nothing else in the check reads the id.
const LEGACY_PLAN_CHECK_OPERATOR = 'release.deploy';
const rows = (text, heading) => tableUnder(text, heading) ?? [];
const fields = (text, heading) => Object.fromEntries(rows(text, heading).map(([k, v]) => [k, v]));
const empty = (v) => v === undefined || v === null || v === '' || v === '—';

export async function migrationPlanErrors(root, branchDir, request) {
  if (!request || request.requirements?.migration == null) return { errors: ['request.json: migration.release runs one frozen plan and migration names none'], plan: null, planSha256: null };
  const own = await validateMigrationReleaseRequest(root, branchDir, request);
  if (own.active) return own;
  return validateMigrationReleaseRequest(root, branchDir, { ...request, operatorId: LEGACY_PLAN_CHECK_OPERATOR });
}

export async function validateMigrationStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, request, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== OPERATOR) return { errors };
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  const has = (f) => existsSync(path.join(branchDir, f));

  for (const key of ['probes', 'steadyDeadline', 'rollbackIdentity']) if (requirements[key] !== undefined) errors.push(`request.json: requirements.${key} belongs to an image release; a migration release rolls nothing out and rolls nothing back`);
  for (const [key, value] of Object.entries(requirements)) if (typeof value === 'string' && credentialShaped(value)) errors.push(`request.json: requirements.${key} carries a credential-shaped value; custody is named, never carried`);
  const binding = await migrationPlanErrors(root, branchDir, request);
  errors.push(...binding.errors);
  if ((response.commits ?? []).length || (response.fallbacks ?? []).length) errors.push('response/response.json: a migration release commits no source and takes no recovery or rollback branch');
  if (response.status !== 'done') {
    if (present.has('migration-release') || present.has('migration-release-proof')) errors.push('response/response.json: a blocked migration release cannot claim a completed migration');
    return { errors };
  }
  for (const kind of ['migration-release', 'migration-release-proof']) if (!present.has(kind)) errors.push(`response/response.json: a migration release requires ${kind}`);
  if (!binding.plan || binding.errors.length || !has(PROOF) || !has(RECEIPT)) return { errors };

  let proof;
  try { proof = JSON.parse(await read(PROOF)); } catch { errors.push(`${PROOF}: not readable JSON`); return { errors }; }
  const proofErrors = migrationReleaseProofErrors(root, branchDir, binding.plan, binding.planSha256, proof);
  errors.push(...proofErrors);
  if (proofErrors.length) return { errors };
  const text = await read(RECEIPT);
  if (credentialShaped(text)) errors.push(`${RECEIPT}: carries a credential-shaped value; the runner resolves custody by name and the receipt records nothing it resolved`);
  const actual = fields(text, '## Binding'), outcome = fields(text, '## Outcome');
  const expected = {
    Operator: OPERATOR, Step: `step-${request.step}/parallel-${request.parallel}`, Project: binding.plan.project,
    Environment: binding.plan.env, Target: binding.plan.target, Release: requirements.release, 'Source head': binding.plan.sourceHead,
    'Plan digest': binding.planSha256, 'Contract fingerprint': binding.plan.contractFingerprint,
    Approval: requirements.approval, 'Connection fingerprint': binding.plan.connectionFingerprint,
  };
  for (const [key, value] of Object.entries(expected)) if (actual[key] !== value) errors.push(`${RECEIPT}: Binding ${key} is ${actual[key] ?? 'absent'}; the plan the request froze says ${value}`);
  if (outcome.Outcome !== 'migrated' || outcome.Replay !== 'no-op' || outcome['Journal before'] !== proof.journalFingerprintBefore || outcome['Journal after'] !== proof.journalFingerprintAfter) errors.push(`${RECEIPT}: Outcome or the journal revisions differ from the proof`);
  const executionRows = rows(text, '## Executions');
  if (executionRows.length !== (proof.executions ?? []).length) errors.push(`${RECEIPT}: Executions has ${executionRows.length} rows, the proof has ${(proof.executions ?? []).length}`);
  for (const [index, row] of executionRows.entries()) {
    const record = proof.executions?.[index];
    if (!record || row[0] !== String(record.invocation) || row[1] !== (record.applied.join(', ') || '—') || row[2] !== '0' || row[3] !== record.logRef || row[4] !== record.logSha256) errors.push(`${RECEIPT}: execution ${index + 1} differs from its captured proof`);
  }
  if (!empty(requirements.release) && !/^release:[A-Za-z0-9._-]+$/.test(String(requirements.release))) errors.push('request.json: release is not a release:<id> identity');
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateMigrationStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write(`valid ${OPERATOR} branch\n`);
}
