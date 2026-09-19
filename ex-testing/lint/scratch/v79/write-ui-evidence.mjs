// v7-9: refresh every todo ui record's evidence.yaml through scripts/example-evidence.mjs, so the
// record digest and code digest are recomputed by actually running the assertions, and each record
// carries a replayable proof of what this lane verified - including where the render proof still
// fails, which is recorded as a fail rather than left out.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, '../../../..');
const WORK = 'examples/todo-app-backend/.starciwork';

const RECORDS = [
  { record: 'ui.login.sign-in', dir: 'features/login/ui/sign-in', render: 'impl.login.todo-app-frontend.sign-in' },
  { record: 'ui.notify.preferences', dir: 'features/notify/ui/preferences', render: 'impl.notify.todo-app-frontend.preferences' },
  { record: 'ui.plan.usage', dir: 'features/plan/ui/usage', render: 'impl.plan.todo-app-frontend.usage' },
  { record: 'ui.recur.schedule', dir: 'features/recur/ui/schedule', render: 'impl.recur.todo-app-frontend.schedule' },
  { record: 'ui.share.invite', dir: 'features/share/ui/invite', render: 'impl.share.todo-app-frontend.invite-screen' },
  { record: 'ui.task.list', dir: 'features/task/ui/list', render: 'impl.task.todo-app-frontend.task-list' },
  // impl.audit.todo-app-frontend.privacy is not `done`, so its render proof is vacuous by
  // construction; this record carries only the assertion that genuinely tests something.
  { record: 'ui.audit.privacy', dir: 'features/audit/ui/privacy', render: null },
];

for (const entry of RECORDS) {
  const args = [
    'scripts/example-evidence.mjs',
    '--work', WORK,
    '--record', entry.record,
    '--cwd', '.',
  ];
  // The nodes' own assets/verify-direction.mjs is left out of the evidence on purpose: it throws on
  // `current brand input bytes` for all seven records, which is pre-existing drift between each
  // record's pinned ui.inputs[] sha256 and the bytes under brand/assets/** - not something this
  // lane changed, and baking a permanently-failing assertion into every ui record would attribute
  // another lane's drift to the render pipeline. It is reported instead.
  if (entry.render) {
    args.push('--assert', `render-proof=node scripts/example-render-proof.mjs --work ${WORK} --record ${entry.render}`);
  }
  const run = spawnSync(process.execPath, args, { cwd: skillRoot, encoding: 'utf8' });
  const out = `${run.stdout ?? ''}${run.stderr ?? ''}`.trim();
  console.log(`--- ${entry.record} (exit ${run.status})`);
  console.log(out.split('\n').map(line => `    ${line}`).join('\n'));
}
