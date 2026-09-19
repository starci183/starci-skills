// v7-3 lane helper: isolate refusals/warnings attributable to THIS lane's owned files, comparing the
// baseline gate log with the post-edit log. Read-only over the two logs.
import fs from 'node:fs';

const OWNED = [
  'features/task/impl/todo-app-frontend/task-list',
  'features/notify/impl/todo-app-frontend/preferences',
  'features/plan/impl/todo-app-frontend/usage',
  'features/recur/impl/todo-app-frontend/schedule',
  'features/share/impl/todo-app-frontend/invite-screen',
  'features/audit/impl/todo-app-frontend/privacy',
  'features/login/impl/todo-app-frontend/sign-in',
  '_resources/',
];

/** class = the trailing [TAG] if present, else a name derived from the message shape. */
const classOf = line => {
  const tag = line.match(/\[([A-Z_]+)\]\s*$/);
  if (tag) return tag[1];
  if (/recordDigest .* no longer matches/.test(line)) return 'RECORD_DIGEST_STALE';
  if (/codeDigest .* no longer matches/.test(line)) return 'CODE_DIGEST_STALE';
  if (/id is /.test(line)) return 'ID_PLACE_MISMATCH';
  return 'OTHER';
};

const tally = file => {
  const out = new Map();
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(l => /^(REFUSED|WARN) /.test(l));
  for (const line of lines) {
    const path = line.slice(line.indexOf(' ') + 1);
    const owned = OWNED.some(o => path.includes(o));
    if (!owned) continue;
    const kind = line.startsWith('REFUSED') ? 'REFUSED' : 'WARN';
    const key = `${kind} ${classOf(line)}`;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return {out, total: lines.filter(l => OWNED.some(o => l.includes(o))).length};
};

const [beforeFile, afterFile] = process.argv.slice(2);
const before = tally(beforeFile);
const after = tally(afterFile);
const keys = [...new Set([...before.out.keys(), ...after.out.keys()])].sort();
console.log(`class                        baseline  after  delta`);
for (const k of keys) {
  const b = before.out.get(k) ?? 0, a = after.out.get(k) ?? 0;
  console.log(`${k.padEnd(27)} ${String(b).padStart(6)}  ${String(a).padStart(5)}  ${a - b > 0 ? `+${a - b}` : a - b}`);
}
console.log(`\nowned-file problem lines: ${before.total} -> ${after.total} (${after.total - before.total > 0 ? '+' : ''}${after.total - before.total})`);
console.log(`(note: _resources/** carries no gate rule today - the realm/compose corrections there are invisible to this gate by design)`);
