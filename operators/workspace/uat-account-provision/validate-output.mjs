import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const issues = [];
  const { outcome, accountRecord, browserLeaseRef, evidenceRefs, reason } = value.output;
  if (outcome === 'provisioned') {
    if (accountRecord === null) issues.push('$.output.accountRecord: required when provisioned');
    if (browserLeaseRef === null) issues.push('$.output.browserLeaseRef: required when provisioned');
    if (reason !== null) issues.push('$.output.reason: must be null when provisioned');
    if (!evidenceRefs.some((ref) => ref.startsWith('keycloak-user://'))) issues.push('$.output.evidenceRefs: Keycloak creation evidence is required');
    if (!evidenceRefs.some((ref) => ref.startsWith('database-user://'))) issues.push('$.output.evidenceRefs: application-database creation evidence is required');
  }
  if (outcome === 'blocked') {
    if (accountRecord !== null || browserLeaseRef !== null) issues.push('$.output: blocked output cannot expose partial account or lease authority');
    if (reason === null) issues.push('$.output.reason: required when blocked');
  }
  return issues;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
