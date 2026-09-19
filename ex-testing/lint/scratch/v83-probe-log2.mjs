// v8-3 scratch probe 2: can a bulk log over `examples/` with -M pair the pre-move path?
import {execFileSync} from 'node:child_process';

const repoRoot = 'D:/Repositories/starci-academy-backend/.claude';
const run = args => execFileSync('git', args, {cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 28});

const target = 'examples/todo-app-backend/.starciwork/features/task/br/complete/once/index.yaml';

let t = Date.now();
const out = run(['log', '-M', '--format=%x02commit %H', '--name-status', '-z', '-n', '80', '--', 'examples/']);
console.log('bulk over examples/ with -M: ms=', Date.now() - t, 'bytes=', out.length);
const fields = out.split('\0').filter(f => f.includes('complete/once/index.yaml'));
console.log('fields mentioning target:', fields.length);
for (const f of fields) console.log('  FIELD ' + JSON.stringify(f));

// commit headers so we can tell which commit each rename line belongs to
const parts = out.split('\0');
let current = '(none)';
for (const p of parts) {
  if (p.startsWith('commit ')) { current = p.slice(7, 15); continue; }
  if (p.includes('complete/once/index.yaml')) console.log('  at commit', current, '->', JSON.stringify(p));
}

t = Date.now();
const noM = run(['log', '--format=%x02commit %H', '--name-status', '-z', '-n', '80', '--', 'examples/']);
console.log('same without -M: ms=', Date.now() - t, 'bytes=', noM.length);
console.log('without -M mentions:', noM.split('\0').filter(f => f.includes('complete/once/index.yaml')).length);
