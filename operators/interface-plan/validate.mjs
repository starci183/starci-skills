// interface.plan's own law over one branch, on top of the shared step check: the Map and the unit list
// are one list — every Map row has a units.json entry with the same id, kind and goal, and every entry
// has its row; a unit of a surface map is a page or a modal; the file names this operator as its
// producer; ids are unique and dependsOn resolves, in the one reading scripts/validate-request.mjs
// publishes; every unit has exactly one Data contracts row and no row names a unit the Map does not;
// the map is titled by the feature the request named; and a MAP_INCOMPLETE stop names, in one
// paragraph, the route or host the map failed to name. The Shell floor (at least one row) and the
// closed Kind and Element vocabularies live in the kind contract and are checked by the response gate.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { unitsErrors } from '../../scripts/validate-request.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OPERATOR = 'interface.plan';
const RECEIPT = 'response/response.md';
const UNITS = 'response/data/units.json';
const INCOMPLETE = 'MAP_INCOMPLETE';
// The kinds a surface map plans; a flow, a table or a module is another plan's unit.
const UNIT_KINDS = new Set(['page', 'modal']);
const empty = (v) => v === undefined || v === null || v === '' || v === '—';

export async function validateInterfacePlanStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== OPERATOR) return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  const receipt = present.has('surface-map') && has(RECEIPT) ? await read(RECEIPT) : null;
  let units = null;
  if (present.has('units') && has(UNITS)) { try { units = JSON.parse(await read(UNITS)); } catch { units = null; } }

  // An incomplete map is named, not narrated: the reason carries every unnamed route or host in one paragraph.
  if (response.status === 'blocked' && response.stop === INCOMPLETE) {
    const reason = String(response.reason ?? '');
    if (!reason.trim()) errors.push(`response/response.json: a ${INCOMPLETE} stop carries a reason naming the route or host the map does not name`);
    else if (/[\r\n]/.test(reason)) errors.push('response/response.json: reason spans more than one paragraph; every unnamed route or host is listed in one so the re-entry names them together');
    if (receipt || units) errors.push(`response/response.json: a ${INCOMPLETE} stop emits no map; the map is written whole or not at all`);
  }

  // The map is titled by the feature the request named.
  if (receipt && !empty(requirements.feature)) {
    const title = receipt.split(/\r?\n/)[0] ?? '';
    if (title !== `# surface-map — ${requirements.feature}`) errors.push(`${RECEIPT}: title names ${title.replace(/^# surface-map — /, '')}, the request names feature ${requirements.feature}`);
  }

  if (receipt && units) {
    if (units.producedBy !== OPERATOR) errors.push(`${UNITS}: producedBy ${units.producedBy} is not ${OPERATOR}; the plan names itself as the producer of its units`);
    errors.push(...unitsErrors(units, UNITS));
    const byId = new Map();
    for (const u of units.units ?? []) {
      if (!byId.has(u.id)) byId.set(u.id, u);
      if (!UNIT_KINDS.has(u.kind)) errors.push(`${UNITS}: unit ${u.id} is a ${u.kind}; a unit of a surface map is a page or a modal`);
    }
    // The Map and the unit list are one list.
    const mapIds = new Set();
    for (const [id, kind, , goal] of tableUnder(receipt, '## Map') ?? []) {
      if (mapIds.has(id)) errors.push(`${RECEIPT}: Map lists ${id} twice; one unit has one row`);
      mapIds.add(id);
      const u = byId.get(id);
      if (!u) { errors.push(`${RECEIPT}: Map row ${id} has no entry in ${UNITS}; the map and the unit list are one list`); continue; }
      if (u.kind !== kind) errors.push(`${RECEIPT}: Map row ${id} is a ${kind}, ${UNITS} says ${u.kind}`);
      if (u.goal !== goal) errors.push(`${RECEIPT}: Map row ${id} goal differs from ${UNITS}; a generator reads one goal line, not two`);
    }
    for (const id of byId.keys()) if (!mapIds.has(id)) errors.push(`${UNITS}: unit ${id} has no Map row; a unit nobody can read in the map is a unit nobody planned`);
    // Every unit has exactly one data contract, and no contract names a unit the map does not.
    const contracted = new Set();
    for (const [id] of tableUnder(receipt, '## Data contracts') ?? []) {
      if (contracted.has(id)) errors.push(`${RECEIPT}: Data contracts lists ${id} twice; one unit has one contract`);
      contracted.add(id);
      if (!mapIds.has(id)) errors.push(`${RECEIPT}: Data contracts names ${id}, which the Map does not`);
    }
    for (const id of mapIds) if (!contracted.has(id)) errors.push(`${RECEIPT}: unit ${id} has no Data contracts row; a blind generator learns what its unit reads and writes from this table or from nothing`);
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateInterfacePlanStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid interface.plan branch\n');
}
