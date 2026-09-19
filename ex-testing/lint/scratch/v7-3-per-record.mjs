// v7-3 lane helper: per-record refusal-class diff for this lane's owned records, baseline vs after.
import fs from 'node:fs';

const RECS = [
  'impl.task.todo-app-frontend.task-list',
  'impl.notify.todo-app-frontend.preferences',
  'impl.plan.todo-app-frontend.usage',
  'impl.recur.todo-app-frontend.schedule',
  'impl.share.todo-app-frontend.invite-screen',
  'impl.audit.todo-app-frontend.privacy',
  'impl.login.todo-app-frontend.sign-in',
];
const DIRS = {
  'impl.task.todo-app-frontend.task-list': 'features/task/impl/todo-app-frontend/task-list',
  'impl.notify.todo-app-frontend.preferences': 'features/notify/impl/todo-app-frontend/preferences',
  'impl.plan.todo-app-frontend.usage': 'features/plan/impl/todo-app-frontend/usage',
  'impl.recur.todo-app-frontend.schedule': 'features/recur/impl/todo-app-frontend/schedule',
  'impl.share.todo-app-frontend.invite-screen': 'features/share/impl/todo-app-frontend/invite-screen',
  'impl.audit.todo-app-frontend.privacy': 'features/audit/impl/todo-app-frontend/privacy',
  'impl.login.todo-app-frontend.sign-in': 'features/login/impl/todo-app-frontend/sign-in',
};

const classOf = line => {
  const tag = line.match(/\[([A-Z_]+)\]\s*$/);
  if (tag) return tag[1];
  if (/recordDigest .* no longer matches/.test(line)) return 'RECORD_DIGEST_STALE';
  if (/codeDigest .* no longer matches/.test(line)) return 'CODE_DIGEST_STALE';
  return 'OTHER';
};

const load = file => {
  const byRecord = new Map(RECS.map(id => [id, new Map()]));
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!/^(REFUSED|WARN) /.test(line)) continue;
    for (const id of RECS) {
      if (!line.includes(DIRS[id])) continue;
      const cls = `${classOf(line)}${line.startsWith('WARN') ? '(warn)' : ''}`;
      const m = byRecord.get(id);
      m.set(cls, (m.get(cls) ?? 0) + 1);
    }
  }
  return byRecord;
};

const [beforeFile, afterFile] = process.argv.slice(2);
const before = load(beforeFile), after = load(afterFile);
const classes = [...new Set([...[...before.values()].flatMap(m => [...m.keys()]), ...[...after.values()].flatMap(m => [...m.keys()])])].sort();
console.log('record'.padEnd(44) + classes.map(c => c.slice(0, 10).padStart(12)).join(''));
console.log(''.padEnd(44) + classes.map(() => '  base->after'.padStart(12)).join(''));
for (const id of RECS) {
  const cells = classes.map(c => {
    const b = before.get(id).get(c) ?? 0, a = after.get(id).get(c) ?? 0;
    return `${b}->${a}`.padStart(12);
  });
  console.log(id.padEnd(44) + cells.join(''));
}
