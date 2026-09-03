// A request made only of an operator's own defaults must pass validate-request. This is the static
// half of "the tables agree with the gates": every Requirements row whose Default is not — is turned
// into a value, every required Input is pointed at a placeholder file, the request is written into a
// throwaway session, and validate-request judges it. A Default the gate cannot accept, or a required
// field the orchestrator could never fill, fails here instead of in a real session.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadOperatorPackages, cellAliases, kindOf, isYes } from './operator-md.mjs';
import { validateRequest, isRequiredField } from './validate-request.mjs';

const unquote = (s) => String(s ?? '').trim().replace(/^`|`$/g, '');
const head = 'a'.repeat(40);

// A Default cell is prose for a person; the orchestrator turns it into a value of the field's Type.
function valueFor(row) {
  const d = unquote(row.default).trim();
  const type = row.type.trim().toLowerCase();
  if (isRequiredField(row)) {
    if (type.startsWith('number')) return 1;
    if (type.startsWith('list')) return ['placeholder'];
    if (type.startsWith('choice')) { const m = /\(([^)]+)\)/.exec(row.type) || /(\w+(?:\s*\|\s*\w+)+)/.exec(row.ask ?? ''); return m ? m[1].split(/\s*\|\s*/)[0].trim() : 'placeholder'; }
    return 'placeholder';
  }
  if (d === 'null' || d === 'none' && type === 'token') return null;
  if (/^\d+$/.test(d)) return Number(d);
  if (type.startsWith('list')) return d === '[]' || d === 'empty' || d === 'rỗng' ? [] : d.split(',').map((s) => s.trim());
  if (d === '[]') return [];
  return d;
}

export async function validateDefaults(root) {
  const errors = [];
  const packages = (await loadOperatorPackages(root)).filter((p) => p.shape === 'v9');
  const session = mkdtempSync(path.join(tmpdir(), 'defaults-'));
  try {
    let n = 0;
    for (const pkg of packages) {
      const op = pkg.en;
      n += 1;
      const branch = path.join(session, `step-${n}`, 'parallel-1');
      mkdirSync(path.join(branch, 'request'), { recursive: true });
      const requirements = {};
      for (const row of op.tables.requirements?.rows ?? []) requirements[unquote(row.field)] = valueFor(row);
      const inputs = {};
      for (const row of op.tables.inputs?.rows ?? []) {
        if (!isYes(row.required)) continue;
        const kind = kindOf(row.kind);
        const producer = path.join(session, 'step-0', 'parallel-1', 'response');
        mkdirSync(path.join(producer, 'data'), { recursive: true });
        const file = `step-0/parallel-1/response/${kind}.md`;
        writeFileSync(path.join(session, file), `# ${kind}\n`);
        inputs[kind] = file;
      }
      const contexts = [];
      for (const row of op.tables.context?.rows ?? []) { const a = cellAliases(row.alias)[0]; if (a) contexts.push({ alias: a.replace(/<[^>]+>/g, 'x'), head: a.startsWith('@workspaces/') ? head : null }); }
      const request = { schemaVersion: 9, operatorId: pkg.manifest.id, step: n, parallel: 1, sessionId: 'defaults', contexts, requirements, inputs, resume: null };
      writeFileSync(path.join(branch, 'request', 'request.json'), JSON.stringify(request, null, 2));
      const { errors: e } = await validateRequest(root, branch, packages);
      for (const line of e) errors.push(`${pkg.manifest.id}: defaults-only request rejected: ${line}`);
    }
  } finally { rmSync(session, { recursive: true, force: true }); }
  return { errors, count: packages.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { errors, count } = await validateDefaults(root);
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write(`defaults closed: ${count} operators accept a defaults-only request\n`);
}
