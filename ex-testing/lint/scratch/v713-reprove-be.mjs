// v7-13 closer: re-runs the full stored assertion set for each stale todo-be evidence file via
// scripts/example-evidence.mjs. Live arms are pointed at the dev stack that is actually running
// (api :3001, postgres compose-postgres-1, redis compose-redis-1, db `todo`). The per-feature
// live-proof scripts still send the retired `x-session-token` header that contract.login
// .identity-for-task rev 3 replaced with `Authorization: Bearer`; each live command therefore runs a
// sed-patched copy of the checked-in script through stdin (`bash -s`) so the recorded command is the
// verbatim, replayable truth of what ran - the script-on-disk defect itself is reported in the v7-13
// report (scripts/ is outside the .starciwork edit scope).
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const CLAUDE = 'D:/Repositories/starci-academy-backend/.claude';
const WORK = 'examples/todo-app-backend/.starciwork';
const BE = 'examples/todo-app-backend';
const FE = 'examples/todo-app-frontend';
const BASH = 'C:\\PROGRA~1\\Git\\bin\\bash.exe';

const lp = (script, env) =>
  `${BASH} -c "sed 's/x-session-token: /Authorization: Bearer /' scripts/${script} | ${env} bash -s"`;
const SHARE_LIVE = lp('live-proof-share.sh', 'API_URL=http://localhost:3001');
const NOTIFY_LIVE = lp('live-proof-notify.sh',
  'API_URL=http://localhost:3001 POSTGRES_CONTAINER=compose-postgres-1 REDIS_CONTAINER=compose-redis-1 NOTIFY_DB=todo');
const RECUR_LIVE = lp('live-proof-recur.sh', 'API_URL=http://localhost:3001 TICK_TIMEOUT_SECONDS=420');
const TASK_LIVE = `${BASH} -c "API_URL=http://localhost:3001 scripts/live-proof.sh"`;

const jobs = [
  {record: 'brand', cwd: CLAUDE, assert: [
    ['brand-rev3-trace-contrast-assets', 'node examples/todo-app-backend/.starciwork/brand/assets/verify-rev3.mjs'],
  ]},
  {record: 'br.task.complete.once', cwd: BE, assert: [
    ['ac.task.complete.once.is-idempotent', 'npx jest src/modules/bussiness/task/complete-task.handler.spec.ts -t "ac.task.complete.once.is-idempotent"'],
    ['ac.task.complete.once.is-reversible', 'npx jest src/modules/bussiness/task/reopen-task.handler.spec.ts -t "ac.task.complete.once.is-reversible"'],
    ['sds.task.completion-state.t-complete', 'npx jest src/modules/bussiness/task/task.service.spec.ts -t "sds.task.completion-state.t-complete:"'],
    ['br.task.complete.once.live-proof', TASK_LIVE],
  ]},
  {record: 'br.task.delete.final', cwd: BE, assert: [
    ['ac.task.delete.final.stays-gone', 'npx jest src/modules/bussiness/task/delete-task.handler.spec.ts -t "ac.task.delete.final.stays-gone"'],
    ['br.task.delete.final.live-proof', TASK_LIVE],
  ]},
  {record: 'br.task.list.owned', cwd: BE, assert: [
    ['ac.task.list.owned.excludes-others', 'npx jest src/modules/bussiness/task/list-tasks.handler.spec.ts -t "ac.task.list.owned.excludes-others"'],
    ['br.task.list.owned.live-proof', TASK_LIVE],
  ]},
  {record: 'br.recur.generation.once', cwd: BE, assert: [
    ['ac.recur.generation.once.is-idempotent-on-rerun', 'npx jest -t "ac.recur.generation.once.is-idempotent-on-rerun"'],
  ]},
  {record: 'impl.recur.todo-app-backend.engine', cwd: BE, assert: [
    ['unit', 'npx jest src/modules/bussiness/recur'],
    ['live-e2e', RECUR_LIVE],
  ]},
  {record: 'impl.share.todo-app-backend.access', cwd: BE, assert: [
    ['unit', 'npx jest src/modules/bussiness/share/completion-authority.spec.ts'],
    ['typecheck', 'npx tsc --noEmit'],
    ['live-proof', SHARE_LIVE],
  ]},
  {record: 'impl.share.todo-app-backend.invitations', cwd: BE, assert: [
    ['unit', 'npx jest src/modules/bussiness/share/invitation.service.spec.ts src/modules/bussiness/share/invite.handler.spec.ts src/modules/bussiness/share/accept-invitation.handler.spec.ts src/modules/bussiness/share/revoke-collaborator.handler.spec.ts src/modules/bussiness/share/list-collaborators.handler.spec.ts'],
    ['typecheck', 'npx tsc --noEmit'],
    ['live-proof', SHARE_LIVE],
  ]},
  {record: 'sds.share.invitation-lifecycle', cwd: BE, assert: [
    ['t-invite', 'npx jest src/modules/bussiness/share/invitation.service.spec.ts -t "creates a pending invitation bound"'],
    ['t-accept', 'npx jest src/modules/bussiness/share/invitation.service.spec.ts -t accept-before-expiry-succeeds'],
    ['t-expire', 'npx jest src/modules/bussiness/share/invitation.service.spec.ts -t expires-after-14-days'],
    ['t-revoke-pending', 'npx jest src/modules/bussiness/share/invitation.service.spec.ts -t "revoking an already revoked invitation is refused"'],
    ['t-revoke-accepted', 'npx jest src/modules/bussiness/share/invitation.service.spec.ts -t "removed-loses-access-next-read"'],
    ['implementation', 'npx jest src/modules/bussiness/share'],
    ['live-proof', SHARE_LIVE],
  ]},
  {record: 'br.share.editor.no-delete', cwd: BE, assert: [
    ['delete-refused-for-editor', 'npx jest src/modules/bussiness/share/completion-authority.spec.ts -t delete-refused-for-editor'],
    ['live-proof', SHARE_LIVE],
  ]},
  {record: 'br.share.invite.expiry', cwd: BE, assert: [
    ['expires-after-14-days', 'npx jest src/modules/bussiness/share/invitation.service.spec.ts -t expires-after-14-days'],
    ['accept-before-expiry-succeeds', 'npx jest src/modules/bussiness/share/invitation.service.spec.ts -t accept-before-expiry-succeeds'],
    ['live-proof', SHARE_LIVE],
  ]},
  {record: 'br.share.revoke.on-read', cwd: BE, assert: [
    ['removed-loses-access-next-read', 'npx jest src/modules/bussiness/share -t removed-loses-access-next-read'],
    ['live-proof', SHARE_LIVE],
  ]},
  {record: 'br.share.role.permissions', cwd: BE, assert: [
    ['viewer-read-only', 'npx jest src/modules/bussiness/share/completion-authority.spec.ts -t viewer-read-only'],
    ['editor-can-complete', 'npx jest src/modules/bussiness/share/completion-authority.spec.ts -t editor-can-complete'],
    ['live-proof', SHARE_LIVE],
  ]},
  {record: 'impl.notify.todo-app-backend.pipeline', cwd: BE, assert: [
    ['unit', 'npx jest src/modules/bussiness/notify src/modules/integrations/notify-smtp src/modules/integrations/notify-queue'],
    ['typecheck', 'npx tsc --noEmit'],
    ['live', NOTIFY_LIVE],
  ]},
  {record: 'integration.notify.queue', cwd: BE, assert: [
    ['live-redis-roundtrip', 'node -r ts-node/register/transpile-only -r tsconfig-paths/register scripts/notify-queue-live-check.cjs'],
  ]},
];

for (const job of jobs) {
  const args = ['scripts/example-evidence.mjs', '--work', WORK, '--record', job.record,
    '--cwd', job.cwd,
    ...job.assert.flatMap(([id, command]) => ['--assert', `${id}=${command}`])];
  console.log(`\n### ${job.record}`);
  const run = spawnSync('node', args, {cwd: CLAUDE, encoding: 'utf8', timeout: 900000});
  const tail = (run.stdout || '') + (run.stderr || '');
  console.log(tail.trim().split('\n').slice(-6).join('\n'));
  console.log(`exit=${run.status} ${run.error ? run.error.message : ''}`);
}
console.log('\nDONE');
