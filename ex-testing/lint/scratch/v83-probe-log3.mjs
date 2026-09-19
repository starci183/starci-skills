// v8-3 scratch probe 3: which bulk-log configuration gives usable per-path version chains?
import {execFileSync} from 'node:child_process';

const repoRoot = 'D:/Repositories/starci-academy-backend/.claude';
const run = args => execFileSync('git', args, {cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 28});
const workRel = 'examples/todo-app-backend/.starciwork';

const tracked = run(['ls-files', '-z', '--', workRel]).split('\0').filter(p => p.endsWith('/index.yaml'));
console.log('tracked index.yaml under tree:', tracked.length);

/** Fields: commit header starts with \x1f; then name-status entries are status, path[, newPath for R/C]. */
function parseChain(text) {
  const fields = text.split('\0');
  const chain = new Map();
  let commit = null;
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (field === '') continue;
    if (field.startsWith('\x1f')) { commit = field.slice(1).trim(); continue; }
    const status = field;
    if (!/^[ACDMRTUXB]\d*$/.test(status) || !commit) { continue; }
    const paths = [fields[++i]];
    if (/^[RC]/.test(status)) paths.push(fields[++i]);
    for (const p of paths.filter(Boolean)) {
      if (!p.endsWith('/index.yaml')) continue;
      const list = chain.get(p) ?? [];
      list.push(commit);
      chain.set(p, list);
    }
  }
  return chain;
}

const variants = {
  default: [],
  'first-parent': ['--first-parent'],
  'diff-merges-fp': ['--diff-merges=first-parent'],
};

for (const [label, extra] of Object.entries(variants)) {
  const t = Date.now();
  const out = run(['log', ...extra, '--format=%x1f%H', '--name-status', '-z', '-n', '60', '--', workRel]);
  const ms = Date.now() - t;
  const chain = parseChain(out);
  const counts = {zero: 0, one: 0, twoPlus: 0};
  for (const p of tracked) {
    const n = (chain.get(p) ?? []).length;
    if (n === 0) counts.zero++;
    else if (n === 1) counts.one++;
    else counts.twoPlus++;
  }
  console.log(`variant ${label}: ${ms}ms; distinct paths listed=${chain.size}`);
  console.log(`   per-path commit counts: zero=${counts.zero} one=${counts.one} two+=${counts.twoPlus}`);
  console.log(`   complete/once chain: ${JSON.stringify(chain.get('examples/todo-app-backend/.starciwork/features/task/br/complete/once/index.yaml')?.map(s => s.slice(0, 8)))}`);
}
