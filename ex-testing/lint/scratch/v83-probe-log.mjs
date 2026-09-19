// v8-3 scratch probe: does a bulk `git log -M --name-status` see the tree move as a rename?
import {execFileSync} from 'node:child_process';

const repoRoot = 'D:/Repositories/starci-academy-backend/.claude';
const run = args => execFileSync('git', args, {cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 28});

let t = Date.now();
const out = run(['log', '-M', '--format=%x01%H', '--name-status', '-z', '-n', '60', '--', 'examples/todo-app-backend/.starciwork']);
console.log('bulk -M ms=', Date.now() - t, 'bytes=', out.length);

const hits = out.split('\0').filter(chunk => chunk.includes('task/br/complete/once'));
console.log('chunks mentioning complete/once:', hits.length);
for (const h of hits) console.log('---\n' + JSON.stringify(h).slice(0, 400));

t = Date.now();
const out2 = run(['log', '--format=%x01%H', '--name-status', '-z', '-n', '60', '--', 'examples/todo-app-backend/.starciwork']);
console.log('bulk no-M ms=', Date.now() - t, 'bytes=', out2.length);
console.log('no-M chunks mentioning complete/once:', out2.split('\0').filter(c => c.includes('task/br/complete/once')).length);
