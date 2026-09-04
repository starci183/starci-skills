import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from './json-schema.mjs';
import { sessionRootOf, validateRequest } from './validate-request.mjs';
import { tableUnder } from './validate-response.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
export function upstreamAuditScope(branch, request, root = ROOT) {
  const ref = request?.inputs?.['frontend-surface-audit'];
  if (!ref) return null;
  if (!/^(?:step-\d+\/parallel-\d+\/)+response\/response\.md$/.test(ref)) throw new Error('audit admission must be a session receipt reference');
  const receipt = path.join(sessionRootOf(branch), ref);
  const verdictFile = path.join(path.dirname(receipt), 'data/verdicts.json');
  const scope = existsSync(verdictFile) ? json(verdictFile).auditScope : null;
  if (!scope) {
    if (existsSync(receipt) && readFileSync(receipt, 'utf8').includes('## Audit scope')) throw new Error('scoped audit admission is missing its typed scope');
    return null;
  }
  const errors = validateAgainst(json(path.join(root, 'templates/kinds/audit-scope.schema.json')), scope, 'auditScope');
  if (errors.length) throw new Error(errors.join('\n'));
  return scope;
}
export function auditScopeCarryErrors(branch, request, response, root = ROOT) {
  try {
    const scope = upstreamAuditScope(branch, request, root);
    const errors = [];
    const ref = response.fields?.['audit-scope'];
    if (scope) {
      if (ref !== 'response/data/audit-scope.json' || !existsSync(path.join(branch, ref))) return ['scoped audit admission must carry response/data/audit-scope.json'];
      if (JSON.stringify(json(path.join(branch, ref))) !== JSON.stringify(scope)) errors.push('audit scope and deferred states must be carried unchanged');
    } else if (ref && ref !== '—') errors.push('audit scope output requires a scoped audit admission');
    const receipt = path.join(branch, 'response/response.md');
    if (existsSync(receipt)) {
      const rows = Object.fromEntries(tableUnder(readFileSync(receipt, 'utf8'), '## Audit scope') ?? []);
      const expected = scope
        ? { Mode: scope.mode, 'Coverage claim': scope.coverageClaim, 'Deferred states': scope.deferredStates.join(', ') || '—' }
        : { Mode: 'not-recorded', 'Coverage claim': 'not-recorded', 'Deferred states': '—' };
      for (const [field, value] of Object.entries(expected)) if (rows[field] !== value) errors.push(`receipt Audit scope ${field} must preserve ${value}`);
    }
    return errors;
  } catch (error) { return [error.message]; }
}
export async function carryAuditScope(branch, root = ROOT) {
  const result = await validateRequest(root, branch);
  if (result.errors.length) throw new Error(result.errors.join('\n'));
  if (!['quality.verify', 'uat.verify'].includes(result.request.operatorId)) throw new Error('scope carry belongs to quality or UAT');
  const scope = upstreamAuditScope(branch, result.request, root);
  if (!scope) return null;
  const destination = path.join(branch, 'response/data/audit-scope.json');
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, JSON.stringify(scope, null, 2) + '\n');
  return scope;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await carryAuditScope(path.resolve(process.argv[2])); process.stdout.write('audit scope carried\n'); }
  catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
