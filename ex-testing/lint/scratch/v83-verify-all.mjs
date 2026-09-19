// v8-3 scratch: run v83-verify-one.mjs over a list of (path, clause-substring) pairs and print condensed rows.
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const cases = [
  ['examples/todo-app-backend/.starciwork/features/login/nfr/sign-in-timing/index.yaml', 'sign-in-timing.mjs'],
  ['examples/todo-app-backend/.starciwork/features/login/contract/identity-for-task/index.yaml', 'x-session-token'],
  ['examples/todo-app-backend/.starciwork/features/plan/gap/sepay-not-reachable/index.yaml', 'sandbox merchant account'],
  ['examples/todo-app-backend/.starciwork/features/plan/fr/upgrade/index.yaml', 'upgrade action exists yet'],
  ['examples/todo-app-backend/.starciwork/features/login/sds/session-store/index.yaml', 'observable: http'],
  ['examples/todo-app-backend/.starciwork/features/login/data/person/index.yaml', 'never read back out'],
  ['examples/todo-app-backend/.starciwork/features/plan/fr/downgrade/index.yaml', 'downgrade action exists yet'],
  ['examples/todo-app-backend/.starciwork/features/plan/uat/upgrade-after-cap/index.yaml', 'upgrade-button.tsx'],
  ['examples/todo-app-backend/.starciwork/features/task/br/single-owner/index.yaml', 'collaborator'],
];

for (const [specPath, clause] of cases) {
  const run = spawnSync(process.execPath,
    [path.join('ex-testing', 'lint', 'scratch', 'v83-verify-one.mjs'), specPath, clause],
    {cwd: 'D:/Repositories/starci-academy-backend/.claude', encoding: 'utf8', maxBuffer: 1 << 28});
  const lines = (run.stdout ?? '').split('\n').filter(l => l.includes('clauseAt='));
  const hit = lines.filter(l => !l.includes('(nowhere)'));
  console.log(`\n### ${specPath.split('/').slice(-3).join('/')}  clause="${clause}"`);
  console.log(`    revisions=${lines.length}  with the clause somewhere=${hit.length}`);
  for (const h of hit.slice(0, 6)) console.log('    ' + h.slice(0, 170));
  if (run.stderr?.trim()) console.log('    stderr: ' + run.stderr.trim().slice(0, 200));
}
