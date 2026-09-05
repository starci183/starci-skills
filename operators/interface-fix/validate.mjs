// interface.fix's own law over one branch, on top of the shared step check and the generator's
// application law (imported, never copied): the request binds exactly one finding, named in the form
// the raising receipt used, and the receipt repeats it under ## Binding; the inventory the values
// come from is the one frozen beside the resolved tree the request's resolution names, and its
// fingerprint still matches that tree (RESOLUTION_STALE otherwise); the plan creates and deletes
// nothing; every class it writes is one the inventory publishes; and when the orchestrator publishes
// a fix size, the paths the plan moves stay inside it (FIX_TOO_LARGE otherwise). The size threshold
// is read from resources/orchestrator.json#fixSize when present and hard-coded nowhere here.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { knowledgeQuestionStopErrors, uiKnowledgeGateErrors } from '../../scripts/ui-knowledge-gate.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { sessionRootOf } from '../../scripts/validate-request.mjs';
import { applicationErrors, resolutionStaleErrors, fingerprintOf, FILES } from '../interface-generate/validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OPERATOR_ID = 'interface.fix';
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const list = (v) => (Array.isArray(v) ? v : empty(v) ? [] : [v]);
// A finding is named the way the raising receipt names it: an audit verdict row as
// <matrixId>/<node>/<rule>, a UAT verdict as <runId>/<step>.
export const AUDIT_FINDING = /^([a-z0-9][a-z0-9-]*)\/(.+)\/([A-Z][A-Z0-9-]*-[0-9]+)$/;
export const UAT_FINDING = /^(\d{8}-\d{6}-[0-9a-f]{7})\/([a-z0-9][a-z0-9-]*)$/;

// The orchestrator's fix size, when it publishes one: { maxFiles } is the only field this validator
// reads; anything else the orchestrator adds is its own. Absent, the size is checked on shape alone.
export async function fixSize(root = ROOT) {
  const file = path.join(root, 'resources', 'orchestrator.json');
  if (!existsSync(file)) return null;
  try { return JSON.parse(await readFile(file, 'utf8')).fixSize ?? null; } catch { return null; }
}

// The inventory and the resolved tree frozen beside the resolution the request named, read through
// the session: <branch>/response/resolution.md → <branch>/response/data/inventory.json and the
// resolved tree that branch's response.json lists.
export async function boundResolution(branchDir, request) {
  const rel = request?.inputs?.['frontend-presentation-resolution'];
  const sessionRoot = sessionRootOf(branchDir);
  if (!rel || !sessionRoot) return { inventory: null, tree: null, treeRef: null };
  const producer = path.join(sessionRoot, path.dirname(path.dirname(String(rel))));
  const read = async (f) => { const full = path.join(producer, f); return existsSync(full) ? readFile(full, 'utf8') : null; };
  let inventory = null;
  const raw = await read(FILES.inventory);
  if (raw !== null) { try { inventory = JSON.parse(raw); } catch { inventory = null; } }
  let tree = null; let treeRef = null;
  let response = null;
  const rawResponse = await read('response/response.json');
  if (rawResponse !== null) { try { response = JSON.parse(rawResponse); } catch { response = null; } }
  for (const ref of list(response?.fields?.['resolved-tree'])) { const text = await read(ref); if (text !== null) { tree = text; treeRef = ref; } }
  return { inventory, tree, treeRef };
}

// The finding the request bound, and the verdict receipt that raised it: exactly one of the two
// raising inputs is present, and the finding is a row of it.
export async function findingErrors({ branchDir, request, requirements = {}, response }) {
  const errors = [];
  const finding = requirements.finding;
  const sessionRoot = sessionRootOf(branchDir);
  const audit = request?.inputs?.['frontend-surface-audit'];
  const walk = request?.inputs?.['uat-flow-verification'];
  if (!audit && !walk) errors.push('request.json: a fix answers a finding some receipt raised; inputs name neither frontend-surface-audit nor uat-flow-verification');
  if (audit && walk) errors.push('request.json: a fix answers one finding of one receipt; inputs name both frontend-surface-audit and uat-flow-verification');
  if (empty(finding)) return { errors, finding: null };
  const auditMatch = AUDIT_FINDING.exec(String(finding));
  const uatMatch = UAT_FINDING.exec(String(finding));
  if (!auditMatch && !uatMatch) errors.push(`request.json: finding ${finding} is neither <matrixId>/<node>/<rule> of an audit verdict row nor <runId>/<step> of a UAT verdict`);
  if (auditMatch && !audit) errors.push(`request.json: finding ${finding} names an audit verdict row and inputs carry no frontend-surface-audit`);
  if (uatMatch && !walk) errors.push(`request.json: finding ${finding} names a UAT verdict and inputs carry no uat-flow-verification`);
  // The row exists in the receipt that raised it: an audit's ## Regressions carries the failing
  // (matrix, node, rule) triples; a UAT receipt's ## Verdicts carries one row per step.
  if (auditMatch && audit && sessionRoot) {
    const file = path.join(sessionRoot, String(audit));
    if (existsSync(file)) {
      const [, matrixId, node, rule] = auditMatch;
      const rows = tableUnder(await readFile(file, 'utf8'), '## Regressions') ?? [];
      if (!rows.some((r) => r[0] === matrixId && r[1] === node && r[2] === rule)) errors.push(`request.json: finding ${finding} is no row of ## Regressions in ${audit}; a fix answers a failure the audit actually recorded`);
    }
  }
  if (uatMatch && walk && sessionRoot) {
    const file = path.join(sessionRoot, String(walk));
    if (existsSync(file)) {
      const [, , step] = uatMatch;
      const rows = tableUnder(await readFile(file, 'utf8'), '## Verdicts') ?? [];
      if (!rows.some((r) => r[0] === step)) errors.push(`request.json: finding ${finding} names step ${step}, which is no row of ## Verdicts in ${walk}`);
    }
  }
  if (response?.status === 'done' && existsSync(path.join(branchDir, FILES.application))) {
    const binding = Object.fromEntries((tableUnder(await readFile(path.join(branchDir, FILES.application), 'utf8'), '## Binding') ?? []).map(([k, v]) => [k, v]));
    if (binding.Finding !== String(finding)) errors.push(`${FILES.application}: Binding names the finding ${binding.Finding ?? '(absent)'}, the request bound ${finding}; the receipt repeats the one finding it answers`);
  }
  return { errors, finding };
}

// The shape of a fix: nothing created or deleted, every class from the inventory (the generator's
// law already refuses one that is not), and, when the orchestrator publishes a size, no more moved
// paths than it allows.
export function fixSizeErrors({ at, plan, size }) {
  const errors = [];
  if (!plan) return errors;
  for (const file of plan.files) {
    if (file.change === 'created' || file.change === 'deleted') errors.push(`${at}: ${file.path} is ${file.change}; a fix creates and deletes nothing, because a new or removed path is a composition decision (FIX_TOO_LARGE)`);
  }
  const moved = plan.files.filter((f) => f.change !== 'unchanged').length;
  if (size && Number.isInteger(size.maxFiles) && moved > size.maxFiles) errors.push(`${at}: the fix moves ${moved} paths and the orchestrator's fix size allows ${size.maxFiles} (FIX_TOO_LARGE); a bigger repair is a surface generated again`);
  return errors;
}

export async function validateFixStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { request, response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== OPERATOR_ID) return { errors };
  errors.push(...knowledgeQuestionStopErrors({ branchDir, response }));
  errors.push(...uiKnowledgeGateErrors({ root, branchDir, bindings: ['@knowledge/ui/presentation', '@knowledge/grammars/<family>'], request, status: response.status }));

  errors.push(...(await findingErrors({ branchDir, request, requirements, response })).errors);
  const { inventory, tree, treeRef } = await boundResolution(branchDir, request);
  errors.push(...resolutionStaleErrors({ at: 'input frontend-presentation-resolution', inventory, tree, treeRef }));
  if (inventory && tree === null && response.status === 'done') errors.push('input frontend-presentation-resolution: the inventory is read beside no resolved tree, so nothing proves it was frozen for the surface this fix repairs (RESOLUTION_STALE)');
  const application = await applicationErrors({ branchDir, root, request, response, requirements, present, inventory, operatorId: OPERATOR_ID });
  errors.push(...application.errors);
  errors.push(...fixSizeErrors({ at: FILES.writes, plan: application.plan, size: await fixSize(root) }));
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateFixStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid interface.fix branch\n');
}
