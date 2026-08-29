import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { validatorFor } from '../operators/validation.mjs';

export const validateResult = validatorFor(new URL('./result.schema.json', import.meta.url), (value) => {
  const errors = [];
  const kinds = new Set(value.checkpoints.map((checkpoint) => checkpoint.kind));
  if (!kinds.has('entry')) errors.push('$.checkpoints: entry checkpoint is required');
  if (!['REQUIRE_USER_ACTION', 'BLOCKED'].includes(value.overall) && !kinds.has('terminal')) errors.push('$.checkpoints: terminal checkpoint is required');
  if (value.caseId !== value.fixture.caseSelector) errors.push('$.fixture.caseSelector: must equal caseId');
  if (value.resources.accountProvisioning === 'fresh' && (!value.resources.account.includes(value.caseId) || !value.resources.account.includes(value.runId))) errors.push('$.resources.account: fresh account must be namespaced by caseId and runId');
  if (!value.resources.declaredBeforeExecute) errors.push('$.resources.declaredBeforeExecute: case identity must be published before execute');
  const authorityFailed = value.uiAuthority.uiPrinciples === 'FAIL' || value.uiAuthority.grammar === 'FAIL';
  const authoritySuspense = value.uiAuthority.uiPrinciples === 'SUSPENSE' || value.uiAuthority.grammar === 'SUSPENSE' || value.uiAuthority.conflict;
  if (authorityFailed && value.verdicts.ui !== 'FAIL') errors.push('$.uiAuthority: either authority failure requires UI FAIL');
  if (value.verdicts.ui === 'PASS' && (value.uiAuthority.uiPrinciples !== 'PASS' || value.uiAuthority.grammar !== 'PASS' || value.uiAuthority.conflict)) errors.push('$.uiAuthority: UI PASS requires both authorities PASS without conflict');
  if (value.verdicts.ui === 'SUSPENSE' && (authorityFailed || !authoritySuspense)) errors.push('$.uiAuthority: UI SUSPENSE requires no authority failure and one unresolved or conflicting authority');
  if (value.overall === 'REQUIRE_USER_ACTION' && value.userActions.length === 0) errors.push('$.userActions: REQUIRE_USER_ACTION requires an exact resumable action');
  if (value.overall !== 'REQUIRE_USER_ACTION' && value.userActions.length > 0) errors.push('$.userActions: actions require REQUIRE_USER_ACTION overall');
  if ((value.overall === 'PASS' || value.overall === 'SUSPENSE') && value.findings.length > 0 && value.overall === 'PASS') errors.push('$.findings: PASS requires no open findings');
  return errors;
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: node uat/validate-result.mjs <result.json>');
    process.exitCode = 2;
  } else {
    const result = validateResult(JSON.parse(fs.readFileSync(path.resolve(target), 'utf8')));
    if (!result.valid) {
      for (const error of result.errors) console.error(error);
      process.exitCode = 1;
    } else console.log('UAT result is valid');
  }
}
