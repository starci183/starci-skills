import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const issues = [];
  const out = value.output;
  const orders = out.caseResults.map((item) => item.executionOrder).sort((a, b) => a - b);
  if (orders.some((order, index) => order !== index + 1)) issues.push('visible Browser executionOrder must be contiguous from 1');
  if (out.caseResults.some((item) => !item.declaredBeforeExecute)) issues.push('every case must be declared before execute');
  if (out.caseResults.some((item) => item.accountProvisioning !== 'fresh-isolated')) issues.push('every case requires a fresh isolated account');
  if (['passed','ready'].includes(out.outcome) && (out.caseResults.some((item) => !item.terminalProved) || out.findings.some((item) => item.severity === 'hard'))) issues.push('success requires terminal proof and rejects hard findings');
  if (out.outcome === 'require-user-action' && out.userActions.length === 0) issues.push('require-user-action requires an exact action');
  if (out.outcome !== 'require-user-action' && out.userActions.length > 0) issues.push('userActions are only valid for require-user-action');
  if (out.coverageSummary !== null) issues.push('coverageSummary must be null outside flow coverage');
  if (out.findings.some((item) => /fixture.*(final|post-journey)|mutation/i.test(item.claim))) issues.push('behavior audit must remain read-only and cannot manufacture success');
  
  if (out.authorityVerdicts !== null) issues.push('authorityVerdicts must be null outside UI audit'); if (out.suspenseQuestions.length > 0) issues.push('suspenseQuestions belong only to UI suspense');
  return issues;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');

