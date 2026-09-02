// errors/INDEX.md is the human table of every stop code the tree knows: the shared ones in
// errors/errors.json and the operator-local ones in operators/<id>/errors.json, merged by
// scripts/errors-registry.mjs. `--check` runs inside npm test so the table cannot drift.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadErrorsRegistry } from './errors-registry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reg = await loadErrorsRegistry(root);
if (reg.errors.length) { process.stderr.write(`${reg.errors.join('\n')}\n`); process.exit(1); }
const code = (s) => `\`${String(s)}\``;
const esc = (s) => String(s).replace(/\|/g, '\\|');
const t = {
  en: {
    title: '# Stop codes',
    intro: 'Every code an operator may stop with: the shared ones from `errors/errors.json` and the operator-local ones from `operators/<id>/errors.json`, merged by `scripts/errors-registry.mjs` and rendered by `scripts/generate-errors-doc.mjs`; `--check` runs inside `npm test`. A code has exactly one disposition: **terminate** ends the step blocked; **fallback** performs the named action, records it under `## Fallbacks taken` in `response.md`, and continues. `unless` names the one Requirements param whose value flips the disposition. `domain` is the `routing.json` domain the stop hands to; `self` is the emitting operator\'s own domain, a resume. A code an operator names that is not here fails `validate-operator`; a runtime meeting an unlisted code terminates with `UNKNOWN_STOP`.',
    head: '| Code | Scope | Domain | Disposition | Meaning | Fallback | Unless | Resume |',
  },
  vi: {
    title: '# Mã dừng',
    intro: 'Mọi mã một operator có thể dừng với: mã chung trong `errors/errors.json` và mã riêng trong `operators/<id>/errors.json`, gộp bởi `scripts/errors-registry.mjs` và kẻ bởi `scripts/generate-errors-doc.mjs`; `--check` chạy trong `npm test`. Một mã có đúng một cách xử lý: **terminate** kết thúc bước ở trạng thái blocked; **fallback** làm đúng hành động đã ghi, ghi lại dưới `## Fallbacks taken` trong `response.md`, rồi chạy tiếp. `unless` gọi tên đúng một tham số Yêu cầu mà giá trị của nó đảo cách xử lý. `domain` là vùng trong `routing.json` mà mã dừng bàn giao tới; `self` là vùng của chính operator phát mã, tức chạy lại. Mã một operator gọi tên mà không có ở đây làm `validate-operator` đỏ; runtime gặp mã không có trong sổ thì dừng với `UNKNOWN_STOP`.',
    head: '| Mã | Phạm vi | Vùng | Xử lý | Nghĩa | Fallback | Trừ khi | Chạy lại |',
  },
};
const scopeKey = (c) => (c.scope.includes('*') ? '' : c.scope.join(','));
function render(lang) {
  const s = t[lang];
  const out = [s.title, '', s.intro, '', s.head, '| --- | --- | --- | --- | --- | --- | --- | --- |'];
  const entries = Object.entries(reg.codes).sort(([a, x], [b, y]) => scopeKey(x).localeCompare(scopeKey(y)) || a.localeCompare(b));
  for (const [id, c] of entries) {
    const unless = c.unless ? `${code(c.unless.param)} = ${code(c.unless.equals)} → ${c.unless.then}` : '—';
    out.push(`| ${code(id)} | ${c.scope.map(code).join(', ')} | ${code(c.domain)} | ${c.disposition} | ${esc(c.meaning[lang])} | ${c.fallback ? esc(c.fallback[lang]) : '—'} | ${unless} | ${esc(c.resume?.[lang] ?? '—')} |`);
  }
  out.push('');
  return `${out.join('\n')}\n`;
}
const check = process.argv.includes('--check');
let drift = 0;
for (const [rel, lang] of [['errors/INDEX.md', 'en'], ['errors/INDEX.vi.md', 'vi']]) {
  const next = render(lang); const file = path.join(root, rel);
  if (check) {
    let cur = ''; try { cur = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n'); } catch { cur = ''; }
    if (cur !== next) { drift += 1; process.stderr.write(`${rel}: out of date; run node scripts/generate-errors-doc.mjs\n`); }
  } else await writeFile(file, next);
}
if (drift) process.exitCode = 1; else process.stdout.write(`${check ? 'stop codes current' : 'stop codes written'}: ${Object.keys(reg.codes).length} codes\n`);
