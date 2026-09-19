// Scratch explorer 4 for lane v8-6: is the declared-vs-disk digest gap a CRLF checkout artifact?
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const HOST = path.resolve(import.meta.dirname, '..', '..', '..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const cases = [
  ['examples/todo-app-backend/.starciwork/features/login/impl/todo-app-frontend/sign-in/assets/sign-in-empty-desktop-1280.png', '384ccde5315c8934cc83df9b0d8a052a38eac0173a4fcbae6c0f2d25eaa64750'],
  ['examples/todo-app-backend/.starciwork/features/login/impl/todo-app-frontend/sign-in/assets/sign-in-empty-desktop-1280.html', 'a4292a47840fbdb749f4aa884b394ccad0ebf9f7133f446088f225e304099a81'],
  ['examples/todo-app-backend/.starciwork/features/task/ui/list/assets/list-many-tasks.png', '9bf10368a731'],
  ['examples/todo-app-backend/.starciwork/features/task/ui/list/assets/list-many-tasks.prompt.txt', 'e1c9d8c08d7c'],
];
for (const [rel, declared] of cases) {
  const abs = path.join(HOST, rel);
  const bytes = fs.readFileSync(abs);
  const lf = Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'));
  console.log(`${path.basename(abs)}: size=${bytes.length} crlf=${bytes.includes(Buffer.from('\r\n'))}`);
  console.log(`   raw=${sha(bytes).slice(0, 16)} lfnorm=${sha(lf).slice(0, 16)} declared=${declared}`);
}
console.log('\n--- .gitattributes ---');
for (const f of ['.gitattributes', 'examples/.gitattributes']) {
  const abs = path.join(HOST, f);
  if (fs.existsSync(abs)) console.log(`### ${f}\n${fs.readFileSync(abs, 'utf8')}`);
  else console.log(`(no ${f})`);
}
