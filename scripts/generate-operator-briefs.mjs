// operators/<id>/brief.md is generated from operator.md: the dispatch prompt of one fresh agent, capped
// at resources/orchestrator.json#briefBytes. It carries what an agent must know before its first tool
// call — the job, the inputs, the requirements, the outputs, the stop codes, the hand-offs — and
// nothing the agent can read for itself at the step it is on. Generating it keeps the brief and the
// operator one home: a table edited in operator.md reaches the brief on the next run, and `--check`
// inside `npm test` refuses a stale or oversized brief.
//
//   node scripts/generate-operator-briefs.mjs            write the briefs
//   node scripts/generate-operator-briefs.mjs --check    fail when a committed brief differs or exceeds the cap
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadOperatorPackages, kindOf, isYes } from './operator-md.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const unquote = (s) => String(s ?? '').trim().replace(/^`|`$/g, '');
const cell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

export function renderBrief(pkg) {
  const op = pkg.en;
  const id = pkg.manifest.id;
  const inputs = (op.tables.inputs?.rows ?? []).filter((r) => kindOf(r.kind) !== '—' && kindOf(r.kind) !== '');
  const lines = [
    `# ${id} — brief`,
    '',
    `Generated from \`operators/${pkg.name}/operator.md\`. Profile \`${pkg.manifest.resources?.profile}\`, dispatch \`${pkg.manifest.resources?.dispatch}\`. Read operator.md for the step you are on; write only response/ of your branch; replace the running skeleton in response.json before you exit. A stop marked * is a fallback.`,
    '',
    '## Job',
    '',
    op.job,
    '',
    '## Inputs',
    '',
    inputs.length ? '| Kind | Required |\n| --- | --- |\n' + inputs.map((r) => `| \`${kindOf(r.kind)}\` | ${isYes(r.required) ? 'yes' : 'no'} |`).join('\n') : 'none: this operator opens the chain.',
    '',
    '## Requirements',
    '',
    '| Field | Type | Default |\n| --- | --- | --- |\n' + (op.tables.requirements?.rows ?? []).map((r) => `| \`${unquote(r.field)}\` | ${cell(r.type).slice(0, 20)} | ${cell(r.default).slice(0, 24)} |`).join('\n'),
    '',
    '## Outputs',
    '',
    '| Kind | File | Type | Required |\n| --- | --- | --- | --- |\n' + (op.tables.outputs?.rows ?? []).map((r) => `| \`${kindOf(r.kind)}\` | \`${unquote(r.file)}\` | ${cell(r.type)} | ${isYes(r.required) ? 'yes' : 'no'} |`).join('\n'),
    '',
    '## Stops',
    '',
    (op.tables.stops?.rows ?? []).map((r) => `\`${unquote(r.code)}\`${cell(r.disposition) === 'fallback' ? '*' : ''}`).join(', '),
    '',
    '## Next',
    '',
    [...new Set((op.tables.next?.rows ?? []).map((r) => unquote(r.operator)))].map((o) => `\`${o}\``).join(', '),
    '',
  ];
  return lines.join('\n');
}

const orchestrator = JSON.parse(await readFile(path.join(root, 'resources', 'orchestrator.json'), 'utf8'));
const cap = orchestrator.briefBytes;
const packages = (await loadOperatorPackages(root)).filter((p) => p.shape === 'v9');
const check = process.argv.includes('--check');
const problems = [];
let written = 0;
for (const pkg of packages) {
  const content = renderBrief(pkg);
  const bytes = Buffer.byteLength(content, 'utf8');
  const file = path.join(pkg.dir, 'brief.md');
  const rel = `operators/${pkg.name}/brief.md`;
  if (bytes > cap) problems.push(`${rel}: ${bytes} bytes exceeds briefBytes ${cap}; shorten the operator's Ask cells or Next table`);
  if (check) {
    const current = existsSync(file) ? (await readFile(file, 'utf8')).replace(/\r\n/g, '\n') : null;
    if (current === null) problems.push(`missing: ${rel}`);
    else if (current !== content) problems.push(`stale: ${rel}`);
  } else { await writeFile(file, content); written += 1; }
}
if (problems.length) { process.stderr.write(`${problems.join('\n')}\nrun: node scripts/generate-operator-briefs.mjs\n`); process.exit(1); }
process.stdout.write(check ? `briefs: ${packages.length} match the tree, all within ${cap} bytes\n` : `briefs: wrote ${written} under operators/<id>/brief.md\n`);
