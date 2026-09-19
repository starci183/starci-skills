// v8-3 scratch probe: what does the escalation `git log --follow` actually return for a record path?
import {spawnSync} from 'node:child_process';

const repoDir = 'D:/Repositories/starci-academy-backend/.claude';
const specPath = 'examples/todo-app-backend/.starciwork/features/task/br/complete/once/index.yaml';

const args = ['log', '--format=\x1f%H', '--name-status', '-z', '--follow', '-n', '50', '--', specPath];
const run = spawnSync('git', args, {cwd: repoDir, encoding: 'utf8', maxBuffer: 1 << 28});
console.log('status=', run.status, 'signal=', run.signal, 'err=', (run.stderr ?? '').slice(0, 300));
const fields = (run.stdout ?? '').split('\0');
for (const field of fields.slice(0, 40)) console.log('  FIELD ' + JSON.stringify(field.slice(0, 120)));
