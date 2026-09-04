// backend.plan's own law over one branch, on top of the shared step check: the Modules table and the
// unit list are one list — every Modules row has a units.json entry with the same id and goal and every
// entry has its row; a unit of a backend plan is a module unit; the file names this operator as its
// producer; ids are unique and dependsOn resolves, in the one reading scripts/validate-request.mjs
// publishes; a plan with zero modules is a stop, never a receipt; no two modules share an operation,
// because an operation two generators fill is filled twice; every proof kind a module names is one the
// proof kind publishes (read from templates/kinds/proof.schema.json, never copied here); the Order
// table and dependsOn say the same thing; when the bound decision's stack-model.json is on disk, every
// contract operation sits in exactly one module and no module names one the contract lacks; the plan
// is titled by the feature the request named; and a MODULE_UNDEFINED stop names, in one paragraph, the
// operation no module can take. The cell shapes live in the kind contract and are checked by the
// response gate.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { unitsErrors } from '../../scripts/validate-request.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OPERATOR = 'backend.plan';
const RECEIPT = 'response/response.md';
const UNITS = 'response/data/units.json';
const UNDEFINED = 'MODULE_UNDEFINED';
const DECISION_INPUT = 'architecture-decision';
const STACK_MODEL = 'data/stack-model.json';
const PROOF_SCHEMA = 'templates/kinds/proof.schema.json';
// The kind a backend plan's units take in the units vocabulary; a page, a modal, a flow or a table is another plan's unit.
const UNIT_KIND = 'module';
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
// A cell of ids: `a`, `b` → [a, b]; a cell of one id reaches here already unquoted by tableUnder; — → [].
const idsOf = (cell) => {
  const s = String(cell ?? '').trim();
  if (!s || s === '—') return [];
  const quoted = [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  return quoted.length ? quoted : s.split(/,\s*/);
};
// The proof kinds the tree publishes: the enum of the proof kind's schema, read where it lives.
async function loadProofKinds(root) {
  try { return new Set(JSON.parse(await readFile(path.join(root, PROOF_SCHEMA), 'utf8')).properties.proofKind.enum); } catch { return null; }
}
// The frozen contract's operation ids: the stack-model.json beside the bound decision, when it is on disk.
async function loadContractOperations(branchDir, request) {
  const decision = request?.inputs?.[DECISION_INPUT];
  if (typeof decision !== 'string' || !decision) return null;
  const file = path.resolve(branchDir, '..', '..', path.dirname(decision), STACK_MODEL);
  if (!existsSync(file)) return null;
  try { const model = JSON.parse(await readFile(file, 'utf8')); return (model.operations ?? []).map((o) => o.operationId).filter(Boolean); } catch { return null; }
}

export async function validateBackendPlanStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, request, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== OPERATOR) return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  const receipt = present.has('backend-plan') && has(RECEIPT) ? await read(RECEIPT) : null;
  let units = null;
  if (present.has('units') && has(UNITS)) { try { units = JSON.parse(await read(UNITS)); } catch { units = null; } }

  // An operation with no module is named, not narrated: the reason carries every such operation in one paragraph.
  if (response.status === 'blocked' && response.stop === UNDEFINED) {
    const reason = String(response.reason ?? '');
    if (!reason.trim()) errors.push(`response/response.json: a ${UNDEFINED} stop carries a reason naming the operation no module can take`);
    else if (/[\r\n]/.test(reason)) errors.push('response/response.json: reason spans more than one paragraph; every operation without a module is listed in one so the re-entry answers them together');
    if (receipt || units) errors.push(`response/response.json: a ${UNDEFINED} stop emits no plan; the plan is written whole or not at all`);
  }

  // The plan is titled by the feature the request named.
  if (receipt && !empty(requirements.featureId)) {
    const title = receipt.split(/\r?\n/)[0] ?? '';
    if (title !== `# backend-plan — ${requirements.featureId}`) errors.push(`${RECEIPT}: title names ${title.replace(/^# backend-plan — /, '')}, the request names featureId ${requirements.featureId}`);
  }

  if (receipt && units) {
    if (units.producedBy !== OPERATOR) errors.push(`${UNITS}: producedBy ${units.producedBy} is not ${OPERATOR}; the plan names itself as the producer of its units`);
    errors.push(...unitsErrors(units, UNITS));
    const list = Array.isArray(units.units) ? units.units : [];
    const rows = tableUnder(receipt, '## Modules') ?? [];
    // A plan with nothing to fill is a stop: a receipt that names zero modules would fan out to nobody and read as done.
    if (response.status === 'done' && (!list.length || !rows.length)) errors.push(`${UNITS}: a plan with zero units is a stop (${UNDEFINED}), not a receipt; a done plan names at least one module`);
    const byId = new Map();
    for (const u of list) {
      if (!byId.has(u.id)) byId.set(u.id, u);
      if (u.kind !== UNIT_KIND) errors.push(`${UNITS}: unit ${u.id} is a ${u.kind}; a unit of a backend plan is a ${UNIT_KIND}`);
    }
    // The Modules table and the unit list are one list; no two modules share an operation; every proof kind is published.
    const proofKinds = await loadProofKinds(root);
    const moduleIds = new Set();
    const claimed = new Map(); // operation -> module
    for (const [id, goal, operations, , proofs] of rows) {
      if (moduleIds.has(id)) errors.push(`${RECEIPT}: Modules lists ${id} twice; one module has one row`);
      moduleIds.add(id);
      const u = byId.get(id);
      if (!u) errors.push(`${RECEIPT}: Modules row ${id} has no entry in ${UNITS}; the plan and the unit list are one list`);
      else if (u.goal !== goal) errors.push(`${RECEIPT}: Modules row ${id} goal differs from ${UNITS}; a generator reads one goal line, not two`);
      for (const op of idsOf(operations)) {
        if (claimed.has(op) && claimed.get(op) !== id) errors.push(`${RECEIPT}: modules ${claimed.get(op)} and ${id} share the operation ${op}; an operation two generators fill is filled twice`);
        else if (claimed.get(op) === id) errors.push(`${RECEIPT}: module ${id} lists the operation ${op} twice`);
        claimed.set(op, id);
      }
      if (proofKinds) for (const kind of idsOf(proofs)) if (!proofKinds.has(kind)) errors.push(`${RECEIPT}: module ${id} names the proof kind ${kind}, which ${PROOF_SCHEMA} does not publish (${[...proofKinds].join(', ')})`);
    }
    for (const id of byId.keys()) if (!moduleIds.has(id)) errors.push(`${UNITS}: unit ${id} has no Modules row; a module nobody can read in the plan is a module nobody planned`);
    // The Order table and dependsOn say the same thing.
    const ordered = new Map();
    for (const [id, after] of tableUnder(receipt, '## Order') ?? []) {
      if (ordered.has(id)) errors.push(`${RECEIPT}: Order lists ${id} twice; one module has one row`);
      if (!moduleIds.has(id)) errors.push(`${RECEIPT}: Order names ${id}, which Modules does not`);
      const deps = idsOf(after);
      for (const d of deps) if (!moduleIds.has(d)) errors.push(`${RECEIPT}: Order puts ${id} after ${d}, which Modules does not name`);
      ordered.set(id, deps);
    }
    for (const [id, u] of byId) {
      const declared = [...(u.dependsOn ?? [])].sort().join(', ');
      const written = [...(ordered.get(id) ?? [])].sort().join(', ');
      if (declared !== written) errors.push(`${RECEIPT}: Order says ${id} runs after ${written || 'nothing'}, ${UNITS} says ${declared || 'nothing'}; the order is recorded once and read twice`);
    }
    // The contract is partitioned, never widened: every operation of the bound stack-model sits in exactly one module.
    const contract = await loadContractOperations(branchDir, request);
    if (contract) {
      const known = new Set(contract);
      for (const op of contract) if (!claimed.has(op)) errors.push(`${RECEIPT}: operation ${op} of the contract belongs to no module; a plan that leaves an operation out sends the generators out with an operation nobody fills`);
      for (const [op, id] of claimed) if (!known.has(op)) errors.push(`${RECEIPT}: module ${id} names the operation ${op}, which the contract does not carry; a module partitions the contract and never widens it`);
    }
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateBackendPlanStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid backend.plan branch\n');
}
