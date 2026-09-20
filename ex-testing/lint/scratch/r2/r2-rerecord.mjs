// r2 lane driver: re-derive stale evidence by re-running scripts/example-evidence.mjs per record.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'ex-testing/lint/.r2-stale-evidence.json'), 'utf8'));
const results = [];
for (const {file, record, asserts} of data) {
  const args = [
    'scripts/example-evidence.mjs',
    '--work', 'examples/todo-app-backend/.starciwork',
    '--record', record,
    '--cwd', 'examples/todo-app-backend',
    ...asserts.flatMap(a => ['--assert', `${a.id}=${a.command}`]),
  ];
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath, args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  } catch (e) {
    code = e.status ?? 1;
    out = (e.stdout ?? '') + (e.stderr ?? '');
  }
  results.push({record, file, code, out: out.trim()});
  console.log(`=== ${record} exit=${code}`);
  console.log(out.trim());
}
fs.writeFileSync(path.join(root, 'ex-testing/lint/.r2-rerecord-log.json'), JSON.stringify(results, null, 2));
const fails = results.filter(r => r.code !== 0);
console.log(`\n${results.length - fails.length}/${results.length} re-recorded clean; ${fails.length} failed`);
for (const f of fails) console.log(`  FAIL ${f.record}`);
