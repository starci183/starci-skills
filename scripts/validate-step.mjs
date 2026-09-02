// One branch of one step, both halves: validate-request on request/request.json, validate-response on
// response/, and the same pair on every nested exchange folder the response awaited or the operator
// declares. Used by operator self-tests and audits; the orchestrator runs the halves separately, the
// request before it spawns the agent and the response after.
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateRequest } from './validate-request.mjs';
import { validateResponse } from './validate-response.mjs';
import { loadOperatorPackages, exchangeOf } from './operator-md.mjs';
import { loadKindTemplates } from './validate-templates.mjs';
import { loadErrorsRegistry } from './errors-registry.mjs';

const unquote = (s) => String(s ?? '').trim().replace(/^`|`$/g, '');

export async function validateStep(root, branchDir) {
  const packages = await loadOperatorPackages(root);
  const kinds = await loadKindTemplates(root);
  const registry = await loadErrorsRegistry(root);
  const req = await validateRequest(root, branchDir, packages);
  const errors = [...req.errors];
  const requirements = req.request?.requirements ?? {};
  const res = await validateResponse(root, branchDir, { requirements, exchange: null, packages, kinds, registry });
  errors.push(...res.errors);
  const present = new Set(res.present);
  const pkg = req.pkg ?? res.pkg;
  if (pkg?.shape === 'v9') {
    const exchanges = new Set((pkg.en.tables.outputs?.rows ?? []).map((r) => exchangeOf(unquote(r.file))).filter(Boolean));
    for (const ex of exchanges) {
      const exDir = path.join(branchDir, ex);
      if (!existsSync(path.join(exDir, 'request', 'request.json'))) { if (res.response?.status === 'done') errors.push(`${ex}/: the operator declares this exchange and the branch is done, but it never ran`); continue; }
      const exReq = await validateRequest(root, exDir, packages);
      errors.push(...exReq.errors);
      const exRes = await validateResponse(root, exDir, { requirements, exchange: ex, packages, kinds, registry });
      errors.push(...exRes.errors);
      for (const k of exRes.present) present.add(k);
      if (res.response?.status === 'done' && exRes.response?.status !== 'done') errors.push(`${ex}/response/response.json: the branch is done but the exchange is ${exRes.response?.status ?? 'missing'}`);
    }
  }
  return { errors, request: req.request, response: res.response, requirements, present, pkg };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node scripts/validate-step.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateStep(root, path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('step valid\n');
}
