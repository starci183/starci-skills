// One branch of one step. The shared laws: validate-request on request/request.json, validate-response
// on response/, and the same pair on every nested exchange folder the response awaited or the operator
// declares. Then, when asked (`operator: true` — the CLI always asks), the operator's own law:
// operators/<id>/validate.mjs, its one export named validate<Name>Step, over the whole branch. Every
// operator validator opens by calling this file for the shared laws, so a validator never dispatches
// itself, and the orchestrator's "step valid" after a branch is this CLI: shared laws and operator law
// in one verdict.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
// The operator's own validator: the one export of operators/<dir>/validate.mjs named validate<Name>Step.
export async function operatorValidator(root, pkg) {
  if (!pkg?.name) return null;
  const file = path.join(root, 'operators', pkg.name, 'validate.mjs');
  if (!existsSync(file)) return null;
  const mod = await import(pathToFileURL(file).href);
  const names = Object.keys(mod).filter((k) => /^validate[A-Za-z]*Step$/.test(k) && typeof mod[k] === 'function');
  if (names.length !== 1) throw new Error(`operators/${pkg.name}/validate.mjs exports ${names.length} step validators (${names.join(', ')}); one operator, one law`);
  return mod[names[0]];
}

export async function validateStep(root, branchDir, { origin = false, operator = false } = {}) {
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
  // The operator's law over the branch the shared laws have read. An origin is judged by its operator through the importer's own path.
  if (operator && !origin && pkg?.shape === 'v9') {
    const law = await operatorValidator(root, pkg);
    if (law) for (const e of (await law(branchDir, root))?.errors ?? []) if (!errors.includes(e)) errors.push(e);
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
  // No top-level await here: the operator validator this dispatch imports imports this file back for the
  // shared laws, and a module still awaiting at top level cannot be imported until it settles.
  validateStep(root, path.resolve(target), { operator: true }).then(({ errors }) => {
    if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('step valid\n');
  }, (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
