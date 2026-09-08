// operator.md is the one authored file of an operator. This module is the one place it is parsed, so
// validate-operator, validate-alias, validate-routing, generate-operators-index and validate-step
// cannot disagree about which table says what. Tables are read by position, so the English file and
// its Vietnamese mirror parse identically; the headings differ per language and are listed here.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const HEADINGS = {
  en: { job: '## Job', doneWhen: '## Done when', context: '## Context', inputs: '## Inputs', requirements: '## Requirements', steps: '## Steps', outputs: '## Outputs', stops: '## Stops', next: '## Next' },
  vi: { job: '## Việc', doneWhen: '## Xong khi', context: '## Context', inputs: '## Đầu vào', requirements: '## Yêu cầu', steps: '## Các bước', outputs: '## Đầu ra', stops: '## Dừng', next: '## Kế tiếp' },
};
export const COLUMNS = {
  context: ['alias', 'bind', 'required'],
  inputs: ['kind', 'from', 'required'],
  requirements: ['field', 'type', 'default', 'ask'],
  steps: ['n', 'step', 'params', 'reads', 'writes', 'stops'],
  outputs: ['kind', 'file', 'type', 'required'],
  stops: ['code', 'disposition'],
  next: ['when', 'operator'],
};
export const YES = new Set(['yes', 'có']);
export const ALIAS = /@[a-z][a-z-]*(?:\/[A-Za-z0-9_<>.@#:-]+)*/g;
const strip = (s) => s.replace(/^`|`$/g, '');

function firstTable(lines, from, to) {
  for (let i = from; i < to - 1; i += 1) {
    if (lines[i].startsWith('|') && /^\|\s*-{3,}/.test(lines[i + 1])) {
      const rows = [];
      for (let j = i + 2; j < to && lines[j].startsWith('|'); j += 1) rows.push(lines[j].split('|').slice(1, -1).map((c) => c.trim()));
      return { header: lines[i].split('|').slice(1, -1).map((c) => c.trim()), rows, line: i + 1 };
    }
  }
  return null;
}

// The one parser of an authored package file. An operator.md and a helper.md differ only in which
// headings they carry and which columns each table has, so both pass their own maps here rather than
// keeping a second copy of the reader (scripts/helper-md.mjs).
export function parseSectioned(text, lang, headingsByLang, columns) {
  const lines = text.split(/\r?\n/);
  const h = headingsByLang[lang];
  const heads = lines.map((l, i) => ({ l: l.trimEnd(), i })).filter((x) => x.l.startsWith('## '));
  const sectionOf = (heading) => {
    const idx = heads.findIndex((x) => x.l === heading);
    if (idx === -1) return null;
    const from = heads[idx].i + 1;
    const to = idx + 1 < heads.length ? heads[idx + 1].i : lines.length;
    return { from, to, line: heads[idx].i + 1 };
  };
  // Prose sections are joined into one line; `headings` keeps every `## ` heading in file order so a
  // validator can check where a section sits, not only that it exists.
  const prose = (sec) => (sec ? lines.slice(sec.from, sec.to).map((l) => l.trim()).filter(Boolean).join(' ') : '');
  const out = { id: (lines[0] ?? '').replace(/^#\s*/, '').replace(/`/g, '').trim(), lang, tables: {}, job: '', doneWhen: '', headings: heads.map((x) => x.l) };
  out.job = prose(sectionOf(h.job));
  out.doneWhen = prose(sectionOf(h.doneWhen));
  for (const key of Object.keys(columns)) {
    const sec = sectionOf(h[key]);
    if (!sec) { out.tables[key] = null; continue; }
    const table = firstTable(lines, sec.from, sec.to);
    if (!table) { out.tables[key] = null; continue; }
    const cols = columns[key];
    out.tables[key] = {
      line: table.line,
      header: table.header,
      rows: table.rows.map((cells, r) => {
        const row = { _line: table.line + 2 + r };
        cols.forEach((c, i) => { row[c] = cells[i] ?? ''; });
        return row;
      }),
    };
  }
  return out;
}

export const parseOperatorMd = (text, lang = 'en') => parseSectioned(text, lang, HEADINGS, COLUMNS);

// Convenience views over the parsed tables.
export const cellCodes = (cell) => [...cell.matchAll(/`([A-Z][A-Z0-9_]+)`/g)].map((m) => m[1]);
export const cellParams = (cell) => (cell.trim() === '—' || cell.trim() === '' ? [] : [...cell.matchAll(/`([a-zA-Z][A-Za-z0-9_]*)`/g)].map((m) => m[1]));
export const cellAliases = (cell) => [...cell.matchAll(ALIAS)].map((m) => m[0]);
// Files are branch-relative: response/<x>.md, response/data/…, response/artifacts/…, response/response.json,
// or <exchange>/response/… for a nested exchange.
export const cellFiles = (cell) => [...cell.matchAll(/`((?:[a-z][a-z-]*\/)?response\/(?:(?:[a-z][a-z-]*\/)*[A-Za-z0-9_<>.-]+\.md|data\/[A-Za-z0-9_<>./-]+|artifacts\/[A-Za-z0-9_<>./-]+|response\.json))`/g)].map((m) => m[1]);
export const exchangeOf = (file) => { const m = /^([a-z][a-z-]*)\/response\//.exec(file); return m ? m[1] : null; };
export const isYes = (cell) => YES.has(strip(cell).trim().toLowerCase());
export const kindOf = (cell) => strip(cell.trim());

export async function loadOperatorPackages(root) {
  const { readdir } = await import('node:fs/promises');
  const { existsSync } = await import('node:fs');
  const dir = path.join(root, 'operators');
  const out = [];
  for (const entry of (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    const manifest = JSON.parse(await readFile(path.join(full, 'operator.json'), 'utf8'));
    const mdPath = path.join(full, 'operator.md');
    if (!existsSync(mdPath)) { out.push({ dir: full, name: entry.name, manifest, shape: 'v8' }); continue; }
    const en = parseOperatorMd(await readFile(mdPath, 'utf8'), 'en');
    const viPath = path.join(full, 'operator.vi.md');
    const vi = existsSync(viPath) ? parseOperatorMd(await readFile(viPath, 'utf8'), 'vi') : null;
    out.push({ dir: full, name: entry.name, manifest, shape: 'v9', en, vi });
  }
  return out;
}
