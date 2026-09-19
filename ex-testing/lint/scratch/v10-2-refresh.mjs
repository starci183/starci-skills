// v10-2 evidence refresh driver: re-runs each touched record's OWN assertion set through
// scripts/example-evidence.mjs's generateEvidence so recordDigest/codeDigest settle honestly
// after the owners expansion. No assertion is dropped or rewritten - the exact recorded
// commands are replayed, including share's live-proof against the running :3001 API.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateEvidence} from '../../../scripts/example-evidence.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workRoot = path.join(root, 'examples/todo-app-backend/.starciwork');
const cwd = path.join(root, 'examples/todo-app-backend');

const J = 'npx jest';
const jobs = [
  ['impl.audit.todo-app-backend.erasure', [
    ['br.audit.erasure.right', `${J} src/modules/bussiness/audit --runInBand -t "ac.audit.erasure.right.identifying-fields-unreadable"`],
    ['br.audit.erasure.logged', `${J} src/modules/bussiness/audit --runInBand -t "ac.audit.erasure.logged.request-and-completion-are-lines"`],
    ['sds.audit.erasure-request', `${J} src/modules/bussiness/audit/audit-erasure.service.spec.ts src/modules/bussiness/audit/request-erasure.handler.spec.ts src/modules/bussiness/audit/complete-erasure.handler.spec.ts --runInBand`],
    ['fr.audit.erasure.request', `${J} src/modules/bussiness/audit --runInBand -t "fr.audit.erasure.request"`],
    ['fr.audit.erasure.complete', `${J} src/modules/bussiness/audit --runInBand -t "fr.audit.erasure.complete"`],
  ]],
  ['impl.audit.todo-app-backend.log', [
    ['br.audit.append-only', `${J} src/modules/bussiness/audit/audit-log.service.spec.ts --runInBand`],
    ['br.audit.retention', `${J} src/modules/bussiness/audit/audit-log.service.spec.ts --runInBand`],
    ['sds.audit.log-chain', `${J} src/modules/bussiness/audit/audit-log.service.spec.ts src/modules/bussiness/audit/audit-event.subscriber.spec.ts --runInBand`],
    ['ac.audit.append-only.chain-detects-tamper', `${J} src/modules/bussiness/audit --runInBand -t "ac.audit.append-only.chain-detects-tamper"`],
  ]],
  ['impl.audit.todo-app-backend.operator-read', [
    ['filtered-whole-chain-read', `${J} src/modules/bussiness/audit --runInBand -t "fr.audit.log.read"`],
    ['fail-closed-refusal', `${J} src/modules/bussiness/audit --runInBand -t "refusal"`],
    ['operator-check', `${J} src/modules/bussiness/audit/audit-operator.guard.spec.ts --runInBand`],
    ['operator-claim-source', `${J} src/modules/bussiness/audit/audit-operator.service.spec.ts --runInBand`],
  ]],
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
  ['impl.task.todo-app-backend.complete-task', [
    ['br.task.complete.once', `${J} src/modules/bussiness/task/complete-task.handler.spec.ts`],
    ['sds.task.completion-state', `${J} src/modules/bussiness/task/task.service.spec.ts`],
    ['event.task.completed', `${J} src/modules/bussiness/task/complete-task.handler.spec.ts -t "event.task.completed"`],
    ['boot-task-lifecycle', `${J} src/app.boot.spec.ts -t "drives sign-in, the full task lifecycle"`],
  ]],
  ['impl.task.todo-app-backend.create-task', [
    ['fr.task.create', `${J} src/modules/bussiness/task/create-task.handler.spec.ts`],
    ['ac.task.title.required.refuses-empty', `${J} -t "ac.task.title.required.refuses-empty"`],
  ]],
  ['impl.task.todo-app-backend.delete-task', [
    ['br.task.delete.final', `${J} src/modules/bussiness/task/delete-task.handler.spec.ts`],
    ['event.task.deleted', `${J} src/modules/bussiness/task/delete-task.handler.spec.ts -t "event.task.deleted"`],
    ['boot-task-lifecycle', `${J} src/app.boot.spec.ts -t "drives sign-in, the full task lifecycle"`],
  ]],
  ['impl.task.todo-app-backend.list', [
    ['br.task.list.owned', `${J} src/modules/bussiness/task/list-tasks.handler.spec.ts`],
    ['contract.task.list-for-dashboard.provider', `${J} src/modules/bussiness/task/task-counts.handler.spec.ts`],
    ['boot-task-lifecycle', `${J} src/app.boot.spec.ts -t "drives sign-in, the full task lifecycle"`],
  ]],
  ['impl.task.todo-app-backend.reopen-task', [
    ['br.task.complete.once', `${J} src/modules/bussiness/task/reopen-task.handler.spec.ts`],
    ['sds.task.completion-state', `${J} src/modules/bussiness/task/task.service.spec.ts`],
    ['boot-task-lifecycle', `${J} src/app.boot.spec.ts -t "drives sign-in, the full task lifecycle"`],
  ]],
  ['impl.task.todo-app-backend.platform-database', [
    ['data.task.task', `${J} src/modules/bussiness/task`],
    ['session-store', `${J} src/modules/bussiness/session`],
  ]],
  // spec records with no own paths - their codeDigest resolves through prover fallback and moved too
  ['fr.audit.log.read', [
    ['fr.audit.log.read', `${J} src/modules/bussiness/audit/audit-log.handler.spec.ts --runInBand`],
    ['operator-check-and-refusal', `${J} src/modules/bussiness/audit/audit-operator.guard.spec.ts --runInBand`],
  ]],
  ['contract.plan.create-precondition', [
    ['provider', `${J} src/modules/bussiness/plan/cap-guard.policy.spec.ts`],
    ['consumer', `${J} src/modules/bussiness/plan/create-precondition.contract.spec.ts`],
  ]],
  ['event.task.completed', [
    ['event.task.completed', `${J} src/modules/bussiness/task/complete-task.handler.spec.ts -t "event.task.completed"`],
  ]],
  ['fr.task.create', [
    ['unit-composed-rules', `${J} src/modules/bussiness/task`],
    ['boot-drives-real-create-route', `${J} src/app.boot.spec.ts -t "drives sign-in, the full task lifecycle"`],
  ]],
  ['event.task.deleted', [
    ['event.task.deleted', `${J} src/modules/bussiness/task/delete-task.handler.spec.ts -t "event.task.deleted"`],
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
console.log(`\n${jobs.length} records refreshed, ${failed} with failing/erroring assertions`);
process.exitCode = failed ? 1 : 0;
