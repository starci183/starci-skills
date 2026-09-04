// operators/<id>/brief.md is generated from operator.md: the dispatch prompt of one fresh agent, capped
// at resources/orchestrator.json#briefBytes. It carries what an agent must know before its first tool
// call — the job, when it is done, the inputs, the outputs, the stop codes — and nothing the agent can
// read for itself at the step it is on or in its request.json. Generating it keeps the brief and the
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
  const optional = (r) => (isYes(r.required) ? '' : ' (optional)');
  // The Requirements are not repeated here: the orchestrator fills their defaults into request.json
  // before dispatch (resources/orchestrator.json#agent.requirements), so the agent reads every value
  // there. The Next table is the orchestrator's, not the agent's: an agent ends its branch and never
  // routes. The profile and dispatch mode are the orchestrator's too. Output types are not repeated
  // either; the file name carries them, and the kind contract is read at the step that writes it.
  const lines = [
    `# ${id} — brief`,
    '',
    'Read operator.md at your step; write only response/ of your branch; replace the running response.json skeleton before you exit; * marks a fallback stop.',
    '',
    '## Job',
    '',
    op.job,
    '',
    '## Done when',
    '',
    op.doneWhen,
    '',
    '## Inputs',
    '',
    inputs.length ? inputs.map((r) => `\`${kindOf(r.kind)}\`${optional(r)}`).join(', ') : 'none',
    '',
    '## Outputs',
    '',
    (op.tables.outputs?.rows ?? []).map((r) => `\`${kindOf(r.kind)}\` \`${unquote(r.file)}\`${optional(r)}`).join('\n'),
    '',
    '## Stops',
    '',
    (op.tables.stops?.rows ?? []).map((r) => `\`${unquote(r.code)}\`${cell(r.disposition) === 'fallback' ? '*' : ''}`).join(', '),
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
  if (bytes > cap) problems.push(`${rel}: ${bytes} bytes exceeds briefBytes ${cap}; find the bytes in the brief format, never in its Done when`);
  if (check) {
    const current = existsSync(file) ? (await readFile(file, 'utf8')).replace(/\r\n/g, '\n') : null;
    if (current === null) problems.push(`missing: ${rel}`);
    else if (current !== content) problems.push(`stale: ${rel}`);
  } else { await writeFile(file, content); written += 1; }
}
if (problems.length) { process.stderr.write(`${problems.join('\n')}\nrun: node scripts/generate-operator-briefs.mjs\n`); process.exit(1); }
process.stdout.write(check ? `briefs: ${packages.length} match the tree, all within ${cap} bytes\n` : `briefs: wrote ${written} under operators/<id>/brief.md\n`);
