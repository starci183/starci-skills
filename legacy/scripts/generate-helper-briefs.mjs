// helpers/<id>/brief.md is generated from helper.md: the prompt of one helper run, capped at the same
// resources/orchestrator.json#briefBytes an operator brief is capped at — one home for that number.
// It carries what a helper must know before its first read: the job, when it is done and its primary
// output, where it may write, what it leaves and what it stops with. It repeats no Requirements (the
// invocation carries their values) and names no Next table, because a helper hands to nobody.
//
// This is a second generator beside scripts/generate-operator-briefs.mjs rather than a shared one:
// that file is a script with top-level effects, not a library, and the two briefs differ in exactly
// the sections that make a helper a helper. What must not be said twice — the cap — is read from the
// same record by both.
//
//   node scripts/generate-helper-briefs.mjs            write the briefs
//   node scripts/generate-helper-briefs.mjs --check    fail when a committed brief differs or exceeds the cap
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { kindOf, cellAliases } from './operator-md.mjs';
import { loadHelperPackages } from './helper-md.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const unquote = (s) => String(s ?? '').trim().replace(/^`|`$/g, '');
const cell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

export function renderHelperBrief(pkg) {
  const op = pkg.en;
  const id = pkg.manifest.id;
  const isolated = pkg.manifest.resources?.mode === 'isolated';
  return [
    `# ${id} — brief`,
    '',
    `You are a helper, not an operator: no session is opened, nothing you write is product source, no runtime is touched, nothing is published, and nobody is asked anything. Read helper.md at your step; write only under the Writes aliases below; leave the run record before you exit.${isolated ? ' You see only what the invocation names; nothing else exists.' : ''}`,
    '',
    '## Job',
    '',
    op.job,
    '',
    '## Done when',
    '',
    op.doneWhen,
    '',
    `Primary output: \`${pkg.manifest.primaryOutput}\``,
    '',
    '## Writes',
    '',
    (op.tables.writes?.rows ?? []).map((r) => `\`${cellAliases(r.alias)[0] ?? unquote(r.alias)}\` — ${cell(r.what)}`).join('\n'),
    '',
    '## Outputs',
    '',
    (op.tables.outputs?.rows ?? []).map((r) => `\`${kindOf(r.kind)}\` \`${unquote(r.file)}\``).join('\n'),
    '',
    '## Stops',
    '',
    (op.tables.stops?.rows ?? []).map((r) => `\`${unquote(r.code)}\`${cell(r.disposition) === 'fallback' ? '*' : ''}`).join(', '),
    '',
  ].join('\n');
}

const orchestrator = JSON.parse(await readFile(path.join(root, 'resources', 'orchestrator.json'), 'utf8'));
const cap = orchestrator.briefBytes;
const packages = (await loadHelperPackages(root)).filter((p) => p.en);
const check = process.argv.includes('--check');
const problems = [];
let written = 0;
for (const pkg of packages) {
  const content = renderHelperBrief(pkg);
  const bytes = Buffer.byteLength(content, 'utf8');
  const file = path.join(pkg.dir, 'brief.md');
  const rel = `helpers/${pkg.name}/brief.md`;
  if (bytes > cap) problems.push(`${rel}: ${bytes} bytes exceeds briefBytes ${cap}; find the bytes in the brief format, never in its Done when`);
  if (check) {
    const current = existsSync(file) ? (await readFile(file, 'utf8')).replace(/\r\n/g, '\n') : null;
    if (current === null) problems.push(`missing: ${rel}`);
    else if (current !== content) problems.push(`stale: ${rel}`);
  } else { await writeFile(file, content); written += 1; }
}
if (problems.length) { process.stderr.write(`${problems.join('\n')}\nrun: node scripts/generate-helper-briefs.mjs\n`); process.exit(1); }
process.stdout.write(check ? `helper briefs: ${packages.length} match the tree, all within ${cap} bytes\n` : `helper briefs: wrote ${written} under helpers/<id>/brief.md\n`);
