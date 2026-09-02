// The request half of one branch (step-N/parallel-M/request/request.json), checked before any agent
// runs: the gate schema; the operator exists and is an operator.md package; every requirement key is
// one the operator declares and every required one (Default —) has a value; every declared input is
// present when required, points inside the session, and the file exists; a nested exchange's request
// names an exchange the operator's Outputs declare. A request that fails here is the orchestrator's
// or the person's mistake, never the agent's.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from './json-schema.mjs';
import { loadOperatorPackages, kindOf, isYes, exchangeOf } from './operator-md.mjs';

const unquote = (s) => String(s ?? '').trim().replace(/^`|`$/g, '');
export const isRequiredField = (row) => row.default.trim().startsWith('—');
export const isEmpty = (v) => v === undefined || v === null || v === '' || v === '—';

// A branch dir is <session>/step-N/parallel-M; an exchange dir is <branch>/<exchange>.
export function sessionRootOf(dir) {
  let cur = path.resolve(dir);
  for (let i = 0; i < 4; i += 1) { if (/^step-\d+$/.test(path.basename(cur))) return path.dirname(cur); cur = path.dirname(cur); }
  return null;
}

export async function validateRequest(root, dir, packages) {
  const errors = [];
  const rel = (f) => path.relative(sessionRootOf(dir) ?? dir, path.join(dir, f)).split(path.sep).join('/');
  const file = path.join(dir, 'request', 'request.json');
  if (!existsSync(file)) return { errors: [`${rel('request/request.json')}: missing`], request: null };
  let request; try { request = JSON.parse(await readFile(file, 'utf8')); } catch (e) { return { errors: [`${rel('request/request.json')}: ${e.message}`], request: null }; }
  const schema = JSON.parse(await readFile(path.join(root, 'templates', 'step', 'request.schema.json'), 'utf8'));
  errors.push(...validateAgainst(schema, request, rel('request/request.json')));
  packages ??= await loadOperatorPackages(root);
  const pkg = packages.find((p) => p.manifest.id === request.operatorId);
  if (!pkg) { errors.push(`request.json: unknown operator ${request.operatorId}`); return { errors, request }; }
  if (pkg.shape !== 'v9') { errors.push(`${request.operatorId} is not an operator.md package`); return { errors, request }; }
  const op = pkg.en;
  const sessionRoot = sessionRootOf(dir);

  if (request.exchange) {
    // A nested exchange: it must be one the operator's Outputs declare, and it carries no person-facing requirements.
    const declared = (op.tables.outputs?.rows ?? []).map((r) => exchangeOf(unquote(r.file))).filter(Boolean);
    if (!declared.includes(request.exchange)) errors.push(`request.json: exchange ${request.exchange} is not declared by an Output of ${op.id}`);
    if (Object.keys(request.requirements ?? {}).length) errors.push('request.json: a nested exchange carries no requirements');
  } else {
    const declared = new Map((op.tables.requirements?.rows ?? []).map((r) => [unquote(r.field), r]));
    for (const key of Object.keys(request.requirements ?? {})) if (!declared.has(key)) errors.push(`request.json: requirements.${key} is not a field ${op.id} declares`);
    for (const [key, row] of declared) if (isRequiredField(row) && isEmpty(request.requirements?.[key])) errors.push(`request.json: required field ${key} has no value`);
    const declaredInputs = new Map((op.tables.inputs?.rows ?? []).map((r) => [kindOf(r.kind), r]));
    for (const kind of Object.keys(request.inputs ?? {})) if (!declaredInputs.has(kind)) errors.push(`request.json: inputs.${kind} is not an Input ${op.id} declares`);
    for (const [kind, row] of declaredInputs) if (isYes(row.required) && isEmpty(request.inputs?.[kind])) errors.push(`request.json: required input ${kind} is absent`);
  }
  for (const [kind, p] of Object.entries(request.inputs ?? {})) {
    if (!sessionRoot) { errors.push(`request.json: inputs.${kind} cannot be resolved; the branch is not under a session`); continue; }
    if (!existsSync(path.join(sessionRoot, p))) errors.push(`request.json: inputs.${kind} = ${p} does not exist in the session`);
  }
  // The orchestrator hashes every request into state.json; a request that changed since is tampering.
  if (sessionRoot && existsSync(path.join(sessionRoot, 'state.json'))) {
    try {
      const state = JSON.parse(await readFile(path.join(sessionRoot, 'state.json'), 'utf8'));
      const key = `${request.step}/${request.parallel}${request.exchange ? `/${request.exchange}` : ''}`;
      const expected = state.requestHashes?.[key];
      if (expected) {
        const { createHash } = await import('node:crypto');
        const actual = `sha256:${createHash('sha256').update(await readFile(file)).digest('hex')}`;
        if (actual !== expected) errors.push(`request.json: hash ${actual} differs from state.json requestHashes[${key}]`);
      }
    } catch (e) { errors.push(`state.json: ${e.message}`); }
  }
  return { errors, request, pkg };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node scripts/validate-request.mjs <session>/step-N/parallel-M[/<exchange>]\n'); process.exit(2); }
  const { errors } = await validateRequest(root, path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('request valid\n');
}
