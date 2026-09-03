// Every rule identifier a knowledge file cites must be one the knowledge tree publishes.
//
// A rule exists only as a `## PREFIX-n — …` heading in a canonical English knowledge file. This
// script builds that inventory, then scans every canonical knowledge file for citations of the shape
// `PREFIX-n` or `PREFIX-a..b` and rejects any that resolve to nothing: a number the topic never
// published, a range that runs past the inventory, or a prefix no file owns. The `.vi.md` mirrors
// are scanned too, because a mirror that cites a rule the English file does not is drift.
//
// Why this exists: `grammars/starci` cited `TONE-4..5`, `RENDER-TRUTH-1..4`, and `GAP-1..5` against a
// tree that publishes `TONE-1..3`, `TRUTH-1..4`, and `GAP-0..6`. Nothing failed, so nobody noticed.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'knowledge');

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

const files = (await walk(root)).sort();
const canonical = files.filter((f) => !f.endsWith('.vi.md'));

// Inventory: one heading per published rule. Prefixes may contain hyphens (CONTROL-STATE, CORE-SURFACE).
// A prefix may carry digits (A11Y); the trailing number is always the ordinal.
const HEADING = /^## ([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*)-(\d+)\b/;
const published = new Map(); // prefix -> Set(number)
const ownerOf = new Map(); // prefix -> file
for (const file of canonical) {
  const text = await readFile(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = HEADING.exec(line);
    if (!m) continue;
    const [, prefix, n] = m;
    if (!published.has(prefix)) {
      published.set(prefix, new Set());
      ownerOf.set(prefix, path.relative(root, file));
    }
    published.get(prefix).add(Number(n));
  }
}

// Citations: PREFIX-n or PREFIX-a..b, where PREFIX is a published prefix or looks like one.
// Tokens whose prefix is unknown are reported once per file so a fabricated family cannot hide.
const CITATION = /\b([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*)-(\d+)(?:\.\.(\d+))?\b/g;
const IGNORE_PREFIXES = new Set(['SHA', 'UTF', 'ISO', 'RFC', 'HTTP', 'ES', 'V', 'H', 'CVE', 'X', 'GPT']);
const errors = [];
for (const file of files) {
  const rel = path.relative(root, file);
  const text = await readFile(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (HEADING.test(line)) return; // the heading is the publication, not a citation
    // A file may name the numbers, or the whole prefix, it retired, so a reader who meets an old
    // citation can still resolve it. Such a line says "retired" (or its mirror "đã nghỉ") and may
    // cite unpublished numbers of a published prefix, or a prefix no file publishes any more.
    const retiredLine = /retired|đã nghỉ/i.test(line);
    for (const m of line.matchAll(CITATION)) {
      const [, prefix, a, b] = m;
      if (IGNORE_PREFIXES.has(prefix)) continue;
      if (retiredLine) continue;
      const set = published.get(prefix);
      if (!set) {
        errors.push(`${rel}:${i + 1}: prefix ${prefix} is published by no knowledge file (${m[0]})`);
        continue;
      }
      const from = Number(a);
      const to = b === undefined ? from : Number(b);
      if (to < from) errors.push(`${rel}:${i + 1}: inverted range ${m[0]}`);
      for (let n = from; n <= to; n += 1) {
        if (!set.has(n)) errors.push(`${rel}:${i + 1}: ${prefix}-${n} is not published (${ownerOf.get(prefix)} publishes ${[...set].sort((x, y) => x - y).join(',')})`);
      }
    }
  });
}

if (errors.length > 0) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else {
  const total = [...published.values()].reduce((n, s) => n + s.size, 0);
  process.stdout.write(`knowledge citations closed: ${published.size} prefixes, ${total} rules, ${files.length} files\n`);
}
