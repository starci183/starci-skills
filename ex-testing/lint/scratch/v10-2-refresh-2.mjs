// v10-2 second pass: the two records whose index.yaml failed to parse on the first run.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateEvidence} from '../../../scripts/example-evidence.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workRoot = path.join(root, 'examples/todo-app-backend/.starciwork');
const cwd = path.join(root, 'examples/todo-app-backend');
const J = 'npx jest';

const jobs = [
  ['impl.plan.todo-app-backend.plan', [
    ['br.plan.caps.limit', `${J} src/modules/bussiness/plan`],
    ['br.plan.active-scope', `${J} src/modules/bussiness/plan/cap-guard.policy.spec.ts`],
    ['br.plan.downgrade.freeze', `${J} src/modules/bussiness/plan/downgrade-plan.handler.spec.ts`],
    ['br.plan.payment.idempotent', `${J} src/modules/bussiness/plan/payment.service.spec.ts src/modules/bussiness/plan/confirm-payment.handler.spec.ts`],
    ['br.plan.lapse.reverts-on-read', `${J} src/modules/bussiness/plan/subscription.service.spec.ts`],
    ['sds.plan.subscription-lifecycle', `${J} src/modules/bussiness/plan/subscription.service.spec.ts`],
    ['sds.plan.cap-guard', `${J} src/modules/bussiness/plan/cap-guard.policy.spec.ts`],
    ['contract.plan.create-precondition', `${J} src/modules/bussiness/plan/create-precondition.contract.spec.ts`],
  ]],
  ['impl.share.todo-app-backend.invitations', [
    ['unit', `${J} src/modules/bussiness/share/invitation.service.spec.ts src/modules/bussiness/share/invite.handler.spec.ts src/modules/bussiness/share/accept-invitation.handler.spec.ts src/modules/bussiness/share/revoke-collaborator.handler.spec.ts src/modules/bussiness/share/list-collaborators.handler.spec.ts`],
    ['typecheck', 'npx tsc --noEmit'],
    ['live-proof', `C:\\PROGRA~1\\Git\\bin\\bash.exe -c "sed 's/x-session-token: /Authorization: Bearer /' scripts/live-proof-share.sh | API_URL=http://localhost:3001 bash -s"`],
  ]],
];

let failed = 0;
for (const [recordId, assertions] of jobs) {
  try {
    const result = generateEvidence({
      workRoot, recordId, cwd,
      assertions: assertions.map(([id, command]) => ({id, command})),
    });
    const bad = result.evidence.assertions.filter(a => a.outcome !== 'pass');
    console.log(`${result.ok ? 'PASS' : 'FAIL'} ${recordId} -> ${path.relative(root, result.evidenceFile)}`);
    for (const a of bad) console.log(`    FAIL ${a.id}: ${a.observation}`);
    if (!result.ok) failed++;
  } catch (error) {
    failed++;
    console.log(`ERROR ${recordId}: ${error.message}`);
  }
}
process.exitCode = failed ? 1 : 0;
