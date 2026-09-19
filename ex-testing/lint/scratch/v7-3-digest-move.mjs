// v7-3 lane helper: for each owned fe impl evidence refusal, print the "now <digest>" the gate
// computed from the record's owners, baseline vs after. Proves whether the corrected route
// directories are actually hashed into the code digest now that they resolve.
import fs from 'node:fs';

const DIRS = {
  tasklist: 'features/task/impl/todo-app-frontend/task-list',
  preferences: 'features/notify/impl/todo-app-frontend/preferences',
  usage: 'features/plan/impl/todo-app-frontend/usage',
  schedule: 'features/recur/impl/todo-app-frontend/schedule',
  'invite-screen': 'features/share/impl/todo-app-frontend/invite-screen',
  privacy: 'features/audit/impl/todo-app-frontend/privacy',
  'sign-in': 'features/login/impl/todo-app-frontend/sign-in',
};

const grab = file => {
  const out = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.includes('evidence.yaml: codeDigest')) continue;
    for (const [name, dir] of Object.entries(DIRS)) {
      if (!line.includes(dir)) continue;
      const stored = line.match(/codeDigest ([0-9a-f]{12})/)?.[1];
      const now = line.match(/\(now ([^)]*)\)/)?.[1]?.slice(0, 12) ?? '?';
      out.set(name, `stored=${stored} now=${now}`);
    }
  }
  return out;
};

const [beforeFile, afterFile] = process.argv.slice(2);
const before = grab(beforeFile), after = grab(afterFile);
for (const name of Object.keys(DIRS)) {
  const b = before.get(name) ?? '(no codeDigest refusal)', a = after.get(name) ?? '(none)';
  const moved = b !== a ? 'MOVED' : 'same';
  console.log(`${name.padEnd(14)} ${moved}\n  baseline ${b}\n  after    ${a}`);
}
