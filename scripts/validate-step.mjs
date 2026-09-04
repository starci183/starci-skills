// One branch of one step, both halves: validate-request on request/request.json, validate-response on
// response/, and the same pair on every nested exchange folder the response awaited or the operator
// declares. Used by operator self-tests and audits; the orchestrator runs the halves separately, the
// request before it spawns the agent and the response after.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateRequest } from './validate-request.mjs';
import { validateResponse } from './validate-response.mjs';
import { loadOperatorPackages, exchangeOf } from './operator-md.mjs';
import { loadKindTemplates } from './validate-templates.mjs';
import { loadErrorsRegistry } from './errors-registry.mjs';

// Only a fully quoted cell is unquoted: a sentence that opens with a code span keeps its backticks.
const unquote = (s) => { const t = String(s ?? '').trim(); return /^`[^`]*`$/.test(t) ? t.slice(1, -1) : t; };

// `origin` is set only for another session's frozen producer being read through an imported slot: its
// request was judged when it ran and its hash is held by the import gate, so the request is read and not
// re-judged by today's session gates, and the response is judged as an origin (validate-response#origin:
// `next` is routing history). The operator's own law still runs on it.
export async function validateStep(root, branchDir, { origin = false } = {}) {
  const packages = await loadOperatorPackages(root);
  const kinds = await loadKindTemplates(root);
  const registry = await loadErrorsRegistry(root);
  const req = origin ? readFrozenRequest(branchDir, packages) : await validateRequest(root, branchDir, packages);
  const errors = [...req.errors];
  const requirements = req.request?.requirements ?? {};
  const res = await validateResponse(root, branchDir, { requirements, exchange: null, packages, kinds, registry, origin });
  errors.push(...res.errors);
  const present = new Set(res.present);
  const pkg = req.pkg ?? res.pkg;
  if (pkg?.shape === 'v9') {
    const exchanges = new Set((pkg.en.tables.outputs?.rows ?? []).map((r) => exchangeOf(unquote(r.file))).filter(Boolean));
    for (const ex of exchanges) {
      const exDir = path.join(branchDir, ex);
      if (!existsSync(path.join(exDir, 'request', 'request.json'))) { if (res.response?.status === 'done') errors.push(`${ex}/: the operator declares this exchange and the branch is done, but it never ran`); continue; }
      const exReq = origin ? readFrozenRequest(exDir, packages) : await validateRequest(root, exDir, packages);
      errors.push(...exReq.errors);
      const exRes = await validateResponse(root, exDir, { requirements, exchange: ex, packages, kinds, registry, origin });
      errors.push(...exRes.errors);
      for (const k of exRes.present) present.add(k);
      if (res.response?.status === 'done' && exRes.response?.status !== 'done') errors.push(`${ex}/response/response.json: the branch is done but the exchange is ${exRes.response?.status ?? 'missing'}`);
    }
  }
  return { errors, request: req.request, response: res.response, requirements, present, pkg };
}

function readFrozenRequest(dir, packages) {
  const file = path.join(dir, 'request', 'request.json');
  if (!existsSync(file)) return { errors: ['request/request.json: missing'], request: null, pkg: null };
  try { const request = JSON.parse(readFileSync(file, 'utf8')); return { errors: [], request, pkg: packages.find((p) => p.manifest.id === request.operatorId) ?? null }; }
  catch (e) { return { errors: [`request/request.json: ${e.message}`], request: null, pkg: null }; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node scripts/validate-step.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateStep(root, path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('step valid\n');
}
