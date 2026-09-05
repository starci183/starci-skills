// helpers/INDEX.md is the reading map of the support layer, generated from every helper.md and
// helper.json the way operators/INDEX.md is generated from the operator packages: what each helper
// reads, where it may write, what it leaves, and every stop code with what it means. `--check` runs
// inside `npm test`, so the map cannot drift from the packages.
//
//   node scripts/generate-helpers-index.mjs            write the map
//   node scripts/generate-helpers-index.mjs --check    fail when the committed map differs
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { kindOf, cellAliases } from './operator-md.mjs';
import { loadHelperPackages } from './helper-md.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const unquote = (s) => String(s ?? '').trim().replace(/^`|`$/g, '');
const cell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const code = (s) => `\`${String(s).replace(/`/g, '')}\``;

const T = {
  en: {
    title: '# Helpers',
    intro: 'The support layer beside the operators. An operator does one job on one unit inside a session chain, under a goal a person confirmed; a helper does support work outside any workflow — it opens no session, writes no product source, touches no runtime, publishes nothing and asks nothing. It prepares and tidies. The law is `resources/orchestrator.json#helpers`, the gate is `scripts/validate-helper.mjs`, and this page is generated from every `helpers/<id>/helper.md` by `scripts/generate-helpers-index.mjs`.',
    invoke: 'A helper is reached from the person and never from a wall: `/helper <id> <args>`, or by naming the job. It runs on its own profile in the mode its `helper.json` declares and leaves one run record under `@worktrees/helpers/<id>/runs/<runId>/`, so every draft it left names the reading that produced it.',
    catalogue: '## The helpers',
    catalogueHead: ['Helper', 'Profile', 'Mode', 'Single job'],
    perHelper: (id) => `## ${id}`,
    job: 'Job',
    doneWhen: 'Done when',
    reads: 'Reads',
    readsHead: ['Alias', 'Bind', 'Required'],
    writes: 'Writes',
    writesHead: ['Alias', 'What'],
    steps: 'Steps',
    stepsHead: ['#', 'Step', 'Writes', 'Stops with'],
    outputs: 'Outputs',
    outputsHead: ['Kind', 'File'],
    stops: 'Stop codes',
    stopsHead: ['Code', 'Disposition', 'Means'],
    source: (rel) => `Source: \`${rel}\`.`,
  },
  vi: {
    title: '# Helper',
    intro: 'Tầng hỗ trợ bên cạnh các operator. Một operator làm một việc trên một đơn vị bên trong chuỗi của phiên, dưới một goal người đã xác nhận; một helper làm việc hỗ trợ ngoài mọi quy trình — nó không mở phiên, không ghi source sản phẩm, không chạm runtime, không publish và không hỏi gì. Nó chuẩn bị và dọn dẹp. Luật nằm ở `resources/orchestrator.json#helpers`, cửa kiểm là `scripts/validate-helper.mjs`, và trang này được sinh từ mọi `helpers/<id>/helper.md` bởi `scripts/generate-helpers-index.mjs`.',
    invoke: 'Helper được gọi từ người dùng chứ không bao giờ từ một bức tường: `/helper <id> <args>`, hoặc bằng cách nêu tên công việc. Nó chạy trên profile của chính nó ở chế độ mà `helper.json` khai báo và để lại một bản ghi lần chạy dưới `@worktrees/helpers/<id>/runs/<runId>/`, để mọi bản phác nó để lại đều gọi tên được lần đọc đã sinh ra nó.',
    catalogue: '## Các helper',
    catalogueHead: ['Helper', 'Profile', 'Chế độ', 'Việc duy nhất'],
    perHelper: (id) => `## ${id}`,
    job: 'Việc',
    doneWhen: 'Xong khi',
    reads: 'Đọc',
    readsHead: ['Alias', 'Bind', 'Bắt buộc'],
    writes: 'Ghi',
    writesHead: ['Alias', 'Cái gì'],
    steps: 'Các bước',
    stepsHead: ['#', 'Bước', 'Ghi', 'Dừng với'],
    outputs: 'Đầu ra',
    outputsHead: ['Kind', 'Tệp'],
    stops: 'Mã dừng',
    stopsHead: ['Mã', 'Xử lý', 'Nghĩa'],
    source: (rel) => `Nguồn: \`${rel}\`. Chỉ tệp tiếng Anh mới là thẩm quyền runtime.`,
  },
};

const table = (header, rows) => [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

function render(packages, errorsByHelper, lang) {
  const t = T[lang];
  const out = [t.title, '', t.intro, '', t.invoke, '', t.catalogue, ''];
  out.push(table(t.catalogueHead, packages.map((p) => [code(p.manifest.id), code(p.manifest.resources?.profile ?? '—'), code(p.manifest.resources?.mode ?? '—'), cell(p.manifest.job)])), '');
  for (const p of packages) {
    const op = lang === 'en' ? p.en : (p.vi ?? p.en);
    const rel = `helpers/${p.name}/helper.${lang === 'en' ? 'md' : 'vi.md'}`;
    out.push(t.perHelper(p.manifest.id), '');
    out.push(`**${t.job}.** ${op.job}`, '');
    out.push(`**${t.doneWhen}.** ${op.doneWhen}`, '');
    out.push(`### ${t.reads}`, '');
    out.push(table(t.readsHead, (op.tables.reads?.rows ?? []).map((r) => [code(cellAliases(r.alias)[0] ?? unquote(r.alias)), cell(r.bind), cell(r.required)])), '');
    out.push(`### ${t.writes}`, '');
    out.push(table(t.writesHead, (op.tables.writes?.rows ?? []).map((r) => [code(cellAliases(r.alias)[0] ?? unquote(r.alias)), cell(r.what)])), '');
    out.push(`### ${t.steps}`, '');
    out.push(table(t.stepsHead, (op.tables.steps?.rows ?? []).map((r) => [cell(r.n), cell(r.step), cell(r.writes), cell(r.stops)])), '');
    out.push(`### ${t.outputs}`, '');
    out.push(table(t.outputsHead, (op.tables.outputs?.rows ?? []).map((r) => [code(kindOf(r.kind)), code(unquote(r.file))])), '');
    out.push(`### ${t.stops}`, '');
    const codes = errorsByHelper.get(p.name) ?? {};
    out.push(table(t.stopsHead, (op.tables.stops?.rows ?? []).map((r) => {
      const id = unquote(r.code);
      return [code(id), cell(r.disposition), cell(codes[id]?.meaning?.[lang] ?? '—')];
    })), '');
    out.push(t.source(rel), '');
  }
  return `${out.join('\n')}\n`;
}

const packages = (await loadHelperPackages(root)).filter((p) => p.en);
const shared = JSON.parse(await readFile(path.join(root, 'operators', 'errors.json'), 'utf8')).codes ?? {};
const errorsByHelper = new Map();
for (const p of packages) {
  let local = {};
  try { local = JSON.parse(await readFile(path.join(p.dir, 'errors.json'), 'utf8')).codes ?? {}; } catch { local = {}; }
  errorsByHelper.set(p.name, { ...Object.fromEntries(Object.entries(shared).filter(([, e]) => (e.scope ?? []).includes('*'))), ...local });
}

const check = process.argv.includes('--check');
let drift = 0;
for (const [rel, lang] of [['helpers/INDEX.md', 'en'], ['helpers/INDEX.vi.md', 'vi']]) {
  const next = render(packages, errorsByHelper, lang);
  const file = path.join(root, rel);
  if (check) {
    let current = ''; try { current = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n'); } catch { current = ''; }
    if (current !== next) { drift += 1; process.stderr.write(`${rel}: out of date; run node scripts/generate-helpers-index.mjs\n`); }
  } else await writeFile(file, next);
}
if (drift) process.exitCode = 1;
else process.stdout.write(`${check ? 'helpers map current' : 'helpers map written'}: ${packages.length} helpers\n`);
