// Every operator document and every knowledge topic conforms to the template of its kind.
//
// A template is `templates/<kind>.template.md`: a human skeleton plus one fenced ```json block
// tagged `template-contract`. The contract says which files it applies to, what the title must
// match, which `##` sections must appear in which order (with `free` zones where a document may add
// its own law sections), which table header a section or a rule must carry, what the closing
// section is, and that a `.vi.md` mirror must exist and follow the Vietnamese form of the same
// contract. The contract is the authority; the skeleton is how a human reads it.
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const CONTRACT_FENCE = /```json template-contract\r?\n([\s\S]*?)\r?\n```/;

export async function loadTemplates(root) {
  const dir = path.join(root, 'templates');
  const templates = [];
  for (const name of (await readdir(dir)).filter((f) => f.endsWith('.template.md')).sort()) {
    const text = await readFile(path.join(dir, name), 'utf8');
    const m = CONTRACT_FENCE.exec(text);
    if (!m) throw new Error(`templates/${name}: no template-contract block`);
    const contract = JSON.parse(m[1]);
    if (contract.kind !== name.replace(/\.template\.md$/, '')) {
      throw new Error(`templates/${name}: contract.kind must equal the file name`);
    }
    templates.push(contract);
  }
  return templates;
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...(await walk(full)));
    } else out.push(full);
  }
  return out;
}

// Glob support is deliberately small: `*` within one segment, `**` across segments.
function globToRegExp(glob) {
  const escaped = glob
    .split('/')
    .map((seg) => (seg === '**' ? '(?:[^/]+/)*' : seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')))
    .join('/')
    .replace(/\(\?:\[\^\/\]\+\/\)\*\//g, '(?:[^/]+/)*');
  return new RegExp(`^${escaped}$`);
}

function headings(lines) {
  const out = [];
  lines.forEach((line, i) => {
    if (/^## /.test(line)) out.push({ text: line.trimEnd(), line: i + 1 });
  });
  return out;
}

function tableHeadersBetween(lines, from, to) {
  const out = [];
  for (let i = from; i < to - 1; i += 1) {
    if (lines[i].startsWith('|') && /^\|\s*-{3,}/.test(lines[i + 1])) out.push({ text: lines[i].trim().replace(/\s+/g, ' '), line: i + 1 });
  }
  return out;
}

function checkDocument(rel, text, contract, lang) {
  const errors = [];
  const lines = text.split(/\r?\n/);
  const title = lines[0] ?? '';
  const titleRe = new RegExp(contract.title[lang], 'u');
  if (!titleRe.test(title)) errors.push(`${rel}:1: title must match ${contract.title[lang]}`);

  const all = headings(lines);
  const ruleRe = contract.rules ? new RegExp(contract.rules.heading, 'u') : null;
  const closingRe = contract.rules?.closing ? new RegExp(contract.rules.closing[lang], 'u') : null;
  const frame = all.filter((h) => !(ruleRe && ruleRe.test(h.text)) && !(closingRe && closingRe.test(h.text)));

  // Walk the ordered section contract against the frame headings.
  let cursor = 0;
  let freeZone = false;
  for (const section of contract.sections ?? []) {
    if (section.free) { freeZone = true; continue; }
    const re = new RegExp(section[lang], 'u');
    let found = -1;
    for (let i = cursor; i < frame.length; i += 1) if (re.test(frame[i].text)) { found = i; break; }
    if (found === -1) { errors.push(`${rel}: missing section ${section[lang]}`); continue; }
    if (found > cursor && !freeZone) {
      for (let i = cursor; i < found; i += 1) errors.push(`${rel}:${frame[i].line}: unexpected section "${frame[i].text}" before ${section[lang]}`);
    }
    if (section.table) {
      const start = frame[found].line;
      const next = all.find((h) => h.line > start);
      const tables = tableHeadersBetween(lines, start, next ? next.line - 1 : lines.length);
      if (tables.length === 0 || tables[0].text !== section.table[lang]) {
        errors.push(`${rel}:${start}: section must open with the table ${section.table[lang]}`);
      }
    }
    cursor = found + 1;
    freeZone = false;
  }
  if (!freeZone && cursor < frame.length && contract.sections !== undefined) {
    for (let i = cursor; i < frame.length; i += 1) errors.push(`${rel}:${frame[i].line}: unexpected trailing section "${frame[i].text}"`);
  }

  // Rules: each heading carries exactly one table of the published shape.
  if (contract.rules) {
    const rules = all.filter((h) => ruleRe.test(h.text));
    if (contract.rules.required && rules.length === 0) errors.push(`${rel}: publishes no rule heading`);
    rules.forEach((rule) => {
      const next = all.find((h) => h.line > rule.line);
      const tables = tableHeadersBetween(lines, rule.line, next ? next.line - 1 : lines.length);
      if (tables.length !== 1) errors.push(`${rel}:${rule.line}: rule must carry exactly one table, found ${tables.length}`);
      else if (tables[0].text !== contract.rules.table[lang]) errors.push(`${rel}:${tables[0].line}: rule table must be ${contract.rules.table[lang]}`);
    });
    if (closingRe) {
      const last = all[all.length - 1];
      if (!last || !closingRe.test(last.text)) errors.push(`${rel}: last section must be ${contract.rules.closing[lang]}`);
    }
  }
  return errors;
}

export async function validateTree(root) {
  const templates = await loadTemplates(root);
  const files = (await walk(root)).map((f) => path.relative(root, f).split(path.sep).join('/'));
  const errors = [];
  let checked = 0;
  const claimed = new Map();
  for (const contract of templates) {
    const matchers = contract.applies.map(globToRegExp);
    // INDEX files are reading indexes, not documents of a kind; they are outside every template.
    const targets = files.filter((f) => f.endsWith('.md') && !f.endsWith('.vi.md') && !/(^|\/)INDEX\.md$/.test(f) && matchers.some((re) => re.test(f)));
    for (const rel of targets) {
      if (claimed.has(rel)) errors.push(`${rel}: claimed by templates ${claimed.get(rel)} and ${contract.kind}`);
      claimed.set(rel, contract.kind);
      const text = await readFile(path.join(root, rel), 'utf8');
      errors.push(...checkDocument(rel, text, contract, 'en'));
      checked += 1;
      const viRel = rel.replace(/\.md$/, '.vi.md');
      if (!files.includes(viRel)) { errors.push(`${rel}: no Vietnamese mirror ${viRel}`); continue; }
      const viText = await readFile(path.join(root, viRel), 'utf8');
      errors.push(...checkDocument(viRel, viText, contract, 'vi'));
      checked += 1;
    }
  }
  return { errors, checked, templates: templates.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { errors, checked, templates } = await validateTree(root);
  if (errors.length > 0) {
    process.stderr.write(`${errors.join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`templates enforced: ${templates} templates, ${checked} documents\n`);
  }
}
