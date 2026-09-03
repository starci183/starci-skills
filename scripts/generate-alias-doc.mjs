// alias/INDEX.md is the human map of every alias an operator may read, grouped by zone, generated
// from alias/alias.json (the machine registry) and from operator.json (who binds what). `--check`
// runs inside npm test so the map cannot drift from the registry. alias.json stays the authority;
// INDEX.md is how a person, or an agent primed with prose, reads it.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadAliasRegistry } from './alias-registry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reg = await loadAliasRegistry(root);
const ZONE_ORDER = ['workspaces', 'grammar', 'knowledge', 'worktrees', 'remote', 'dynamic'];

// Who binds each alias, from every operator.json.
const users = new Map();
const opsDir = path.join(root, 'operators');
for (const e of await readdir(opsDir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const m = JSON.parse(await readFile(path.join(opsDir, e.name, 'operator.json'), 'utf8'));
  for (const r of m.refs ?? []) {
    const base = Object.keys(reg.aliases).filter((k) => r.alias === k || r.alias.startsWith(`${k}/`)).sort((a, b) => b.length - a.length)[0];
    if (!base) continue;
    users.set(base, [...(users.get(base) ?? []), `${m.id}${r.required ? '' : ' (optional)'}`]);
  }
}
const esc = (s) => String(s).replace(/\|/g, '\\|');
const code = (s) => `\`${String(s).replace(/`/g, '')}\``;
const t = {
  en: { title: '# Alias', intro: 'Every location an operator may read, by alias, grouped by zone. Generated from `alias/alias.json` (the machine registry) and every `operator.json` by `scripts/generate-alias-doc.mjs`; `--check` runs inside `npm test`. An operator reads only the aliases its own `operator.md` Context table names; this page is the whole vocabulary those tables draw from. Resolution takes the longest registered prefix, a sub-path narrows an alias, and a segment in angle brackets is supplied by the invocation.', zone: 'Zone', head: '| Alias | Params | Resolves to | Bind | Writers | Bound by | Purpose |', seg: '## Friendly segments inside a checkout', segHead: '| Segment | Resolves to |', zones: { workspaces: 'Workspaces — the working area', grammar: 'Grammar — the package', knowledge: 'Knowledge — the law', worktrees: 'Worktrees — local authority and evidence', remote: 'Remote — the internet', dynamic: 'Dynamic — produced inside the session' } },
  vi: { title: '# Alias', intro: 'Mọi nơi một operator được đọc, theo alias, gom theo vùng. Sinh từ `alias/alias.json` (sổ cho máy) và mọi `operator.json` bởi `scripts/generate-alias-doc.mjs`; `--check` chạy trong `npm test`. Operator chỉ đọc những alias mà bảng Context trong `operator.md` của nó gọi tên; trang này là toàn bộ từ vựng mà các bảng đó lấy ra. Phân giải theo tiền tố đăng ký dài nhất, đuôi đường dẫn thu hẹp alias, đoạn trong ngoặc nhọn do lần gọi cung cấp.', zone: 'Vùng', head: '| Alias | Tham số | Trỏ tới | Bind | Ai ghi | Operator ràng | Mục đích |', seg: '## Đoạn thân thiện trong một checkout', segHead: '| Đoạn | Trỏ tới |', zones: { workspaces: 'Workspaces — vùng làm việc', grammar: 'Grammar — gói', knowledge: 'Knowledge — luật', worktrees: 'Worktrees — thẩm quyền và bằng chứng máy-cục-bộ', remote: 'Remote — internet', dynamic: 'Dynamic — sinh trong phiên' } },
};
function render(lang) {
  const s = t[lang];
  const out = [s.title, '', s.intro, ''];
  for (const z of ZONE_ORDER) {
    const entries = Object.entries(reg.aliases).filter(([, v]) => v.zone === z).sort(([a], [b]) => a.localeCompare(b));
    if (!entries.length) continue;
    out.push(`## ${s.zones[z]}`, '', reg.zones?.[z]?.[lang] ?? '', '', s.head, '| --- | --- | --- | --- | --- | --- | --- |');
    for (const [alias, v] of entries) {
      const params = v.params.length ? v.params.map((p) => code(`<${p}>`)).join(', ') : '—';
      const writers = v.writers.length ? v.writers.map(code).join(', ') : '—';
      const bound = users.get(alias)?.length ? users.get(alias).map(code).join(', ') : '—';
      out.push(`| ${code(alias)} | ${params} | ${code(v.resolvesTo)} | ${esc(v.bind).replace(/</g, '&lt;').replace(/>/g, '&gt;')} | ${writers} | ${bound} | ${esc(v.purpose)} |`);
    }
    out.push('');
  }
  if (reg.segments) {
    out.push(s.seg, '', reg.segments.note ?? '', '', s.segHead, '| --- | --- |');
    for (const [k, v] of Object.entries(reg.segments)) if (k !== 'note') out.push(`| ${code(k)} | ${code(v)} |`);
    out.push('');
  }
  return `${out.join('\n')}\n`;
}
const check = process.argv.includes('--check');
let drift = 0;
for (const [rel, lang] of [['alias/INDEX.md', 'en'], ['alias/INDEX.vi.md', 'vi']]) {
  const next = render(lang); const file = path.join(root, rel);
  if (check) {
    let cur = ''; try { cur = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n'); } catch { cur = ''; }
    if (cur !== next) { drift += 1; process.stderr.write(`${rel}: out of date; run node scripts/generate-alias-doc.mjs\n`); }
  } else await writeFile(file, next);
}
const unzoned = Object.entries(reg.aliases).filter(([, v]) => !ZONE_ORDER.includes(v.zone)).map(([k]) => k);
if (unzoned.length) { process.stderr.write(`aliases without a known zone: ${unzoned.join(', ')}\n`); drift += 1; }
if (drift) process.exitCode = 1; else process.stdout.write(`${check ? 'alias map current' : 'alias map written'}: ${Object.keys(reg.aliases).length} aliases in ${ZONE_ORDER.length} zones\n`);
