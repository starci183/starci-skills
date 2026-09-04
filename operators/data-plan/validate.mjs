// data.plan's own law over one branch, on top of the shared step check: the Units table and the unit
// list are one list — every Units row has a units.json entry with the same id and goal and every entry
// has its row; a unit of a seed plan is a table unit; the file names this operator as its producer; ids
// are unique and dependsOn resolves, in the one reading scripts/validate-request.mjs publishes; a plan
// with zero units is a stop, never a receipt; no two units share a namespace, because two seeders on
// one namespace share a cleanup; every unit has at least one Targets row, no Targets row names a unit
// the plan does not, and one unit names one store once; the plan is titled by the feature the request
// named; and a SEED_UNDEFINED stop names, in one paragraph, the flow or family no store can hold. The
// namespace and store shapes, the attribution vocabulary and the volume floor live in the kind
// contract and are checked by the response gate.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { unitsErrors } from '../../scripts/validate-request.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OPERATOR = 'data.plan';
const RECEIPT = 'response/response.md';
const UNITS = 'response/data/units.json';
const UNDEFINED = 'SEED_UNDEFINED';
// The kind a seed plan's units take in the units vocabulary; a page, a modal, a flow or a module is another plan's unit.
const UNIT_KIND = 'table';
const empty = (v) => v === undefined || v === null || v === '' || v === '—';

export async function validateDataPlanStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== OPERATOR) return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  const receipt = present.has('seed-plan') && has(RECEIPT) ? await read(RECEIPT) : null;
  let units = null;
  if (present.has('units') && has(UNITS)) { try { units = JSON.parse(await read(UNITS)); } catch { units = null; } }

  // A seed nobody can place is named, not narrated: the reason carries every such flow or family in one paragraph.
  if (response.status === 'blocked' && response.stop === UNDEFINED) {
    const reason = String(response.reason ?? '');
    if (!reason.trim()) errors.push(`response/response.json: a ${UNDEFINED} stop carries a reason naming the flow or family no store can hold`);
    else if (/[\r\n]/.test(reason)) errors.push('response/response.json: reason spans more than one paragraph; every flow or family without a store is listed in one so the re-entry answers them together');
    if (receipt || units) errors.push(`response/response.json: a ${UNDEFINED} stop emits no plan; the plan is written whole or not at all`);
  }

  // The plan is titled by the feature the request named.
  if (receipt && !empty(requirements.feature)) {
    const title = receipt.split(/\r?\n/)[0] ?? '';
    if (title !== `# seed-plan — ${requirements.feature}`) errors.push(`${RECEIPT}: title names ${title.replace(/^# seed-plan — /, '')}, the request names feature ${requirements.feature}`);
  }

  if (receipt && units) {
    if (units.producedBy !== OPERATOR) errors.push(`${UNITS}: producedBy ${units.producedBy} is not ${OPERATOR}; the plan names itself as the producer of its units`);
    errors.push(...unitsErrors(units, UNITS));
    const list = Array.isArray(units.units) ? units.units : [];
    const rows = tableUnder(receipt, '## Units') ?? [];
    // A plan with nothing to seed is a stop: a receipt that names zero units would fan out to nobody and read as done.
    if (response.status === 'done' && (!list.length || !rows.length)) errors.push(`${UNITS}: a plan with zero units is a stop (${UNDEFINED}), not a receipt; a done plan names at least one unit`);
    const byId = new Map();
    for (const u of list) {
      if (!byId.has(u.id)) byId.set(u.id, u);
      if (u.kind !== UNIT_KIND) errors.push(`${UNITS}: unit ${u.id} is a ${u.kind}; a unit of a seed plan is a ${UNIT_KIND}`);
    }
    // The Units table and the unit list are one list; every unit owns its namespace.
    const unitIds = new Set();
    const namespaces = new Map();
    for (const [id, , namespace, goal] of rows) {
      if (unitIds.has(id)) errors.push(`${RECEIPT}: Units lists ${id} twice; one unit has one row`);
      unitIds.add(id);
      const u = byId.get(id);
      if (!u) errors.push(`${RECEIPT}: Units row ${id} has no entry in ${UNITS}; the plan and the unit list are one list`);
      else if (u.goal !== goal) errors.push(`${RECEIPT}: Units row ${id} goal differs from ${UNITS}; a seeder reads one goal line, not two`);
      if (namespaces.has(namespace)) errors.push(`${RECEIPT}: units ${namespaces.get(namespace)} and ${id} share the namespace ${namespace}; two seeders on one namespace share a cleanup`);
      namespaces.set(namespace, id);
    }
    for (const id of byId.keys()) if (!unitIds.has(id)) errors.push(`${UNITS}: unit ${id} has no Units row; a unit nobody can read in the plan is a unit nobody planned`);
    // Every unit has at least one target, no target names a unit the plan does not, and one unit names one store once.
    const targeted = new Set();
    const pairs = new Set();
    for (const [id, store] of tableUnder(receipt, '## Targets') ?? []) {
      if (!unitIds.has(id)) errors.push(`${RECEIPT}: Targets names ${id}, which Units does not`);
      const pair = `${id} ${store}`;
      if (pairs.has(pair)) errors.push(`${RECEIPT}: Targets lists ${store} twice for ${id}; one unit names one store once, with one volume and one rollback`);
      pairs.add(pair);
      targeted.add(id);
    }
    for (const id of unitIds) if (!targeted.has(id)) errors.push(`${RECEIPT}: unit ${id} has no Targets row; a seeder learns which store its rows land in, whose they are and how many from this table or from nothing`);
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateDataPlanStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid data.plan branch\n');
}
