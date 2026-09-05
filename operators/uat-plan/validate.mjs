// uat.plan's own law over one branch, on top of the shared step check: the Flows table and the unit
// list are one list — every Flows row has a units.json entry with the same id and every entry has its
// row; a unit of a UAT plan is a flow; the file names this operator as its producer; ids are unique and
// dependsOn resolves, in the one reading scripts/validate-request.mjs publishes; no two flows share an
// account alias or a seed namespace, because two walkers that share either prove each other's run; the
// plan is titled by the feature the request named; and a FLOW_UNDEFINED stop names, in one paragraph,
// the journey that has no entry. The step budget floor and the alias and namespace shapes live in the
// kind contract and are checked by the response gate. The Flows table's Tier column is the same
// tiering the unit list carries, written where a person reads it: `journey` for a flow the mission's
// done-when journey walks, `secondary — <reason>` for one it does not, and only a journey flow is ever
// dispatched to the walker (scripts/unchecked.mjs). A flow the feature already carries an open walk entry on is
// paid by tiering it into the journey or extended with a reason, never dropped from the plan.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { unitsErrors, hostRootOf } from '../../scripts/validate-request.mjs';
import { openUnchecked, planUncheckedErrors, laneOfPlan, tierErrors } from '../../scripts/unchecked.mjs';
import { ledgerKeyOf } from '../../scripts/record-unchecked.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OPERATOR = 'uat.plan';
const RECEIPT = 'response/response.md';
const UNITS = 'response/data/units.json';
const UNDEFINED = 'FLOW_UNDEFINED';
const empty = (v) => v === undefined || v === null || v === '' || v === '—';

export async function validateUatPlanStep(branchDir, root = ROOT, { uncheckedRoot = null } = {}) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== OPERATOR) return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  const receipt = present.has('uat-plan') && has(RECEIPT) ? await read(RECEIPT) : null;
  let units = null;
  if (present.has('units') && has(UNITS)) { try { units = JSON.parse(await read(UNITS)); } catch { units = null; } }

  // A journey with no entry is named, not narrated: the reason carries every such journey in one paragraph.
  if (response.status === 'blocked' && response.stop === UNDEFINED) {
    const reason = String(response.reason ?? '');
    if (!reason.trim()) errors.push(`response/response.json: a ${UNDEFINED} stop carries a reason naming the journey that has no entry route`);
    else if (/[\r\n]/.test(reason)) errors.push('response/response.json: reason spans more than one paragraph; every journey without an entry is listed in one so the re-entry answers them together');
    if (receipt || units) errors.push(`response/response.json: a ${UNDEFINED} stop emits no plan; the plan is written whole or not at all`);
  }

  // The plan is titled by the feature the request named.
  if (receipt && !empty(requirements.feature)) {
    const title = receipt.split(/\r?\n/)[0] ?? '';
    if (title !== `# uat-plan — ${requirements.feature}`) errors.push(`${RECEIPT}: title names ${title.replace(/^# uat-plan — /, '')}, the request names feature ${requirements.feature}`);
  }

  if (receipt && units) {
    if (units.producedBy !== OPERATOR) errors.push(`${UNITS}: producedBy ${units.producedBy} is not ${OPERATOR}; the plan names itself as the producer of its units`);
    errors.push(...unitsErrors(units, UNITS));
    const byId = new Map();
    for (const u of units.units ?? []) {
      if (!byId.has(u.id)) byId.set(u.id, u);
      if (u.kind !== 'flow') errors.push(`${UNITS}: unit ${u.id} is a ${u.kind}; a unit of a UAT plan is a flow`);
    }
    // The Flows table and the unit list are one list; every flow owns its alias and its namespace.
    const flowIds = new Set();
    const aliases = new Map();
    const namespaces = new Map();
    const tierRows = [];
    for (const [id, , , alias, namespace, tier] of tableUnder(receipt, '## Flows') ?? []) {
      if (flowIds.has(id)) errors.push(`${RECEIPT}: Flows lists ${id} twice; one flow has one row`);
      flowIds.add(id);
      tierRows.push([id, tier]);
      if (!byId.has(id)) errors.push(`${RECEIPT}: Flows row ${id} has no entry in ${UNITS}; the plan and the unit list are one list`);
      if (aliases.has(alias)) errors.push(`${RECEIPT}: flows ${aliases.get(alias)} and ${id} share the account alias ${alias}; two walkers that share a sign-in prove each other's session`);
      aliases.set(alias, id);
      if (namespaces.has(namespace)) errors.push(`${RECEIPT}: flows ${namespaces.get(namespace)} and ${id} share the seed namespace ${namespace}; one run's rollback would be the other's failure`);
      namespaces.set(namespace, id);
    }
    errors.push(...tierErrors(tierRows, units, { at: RECEIPT, table: 'Flows' }));
    // Every entry this feature already carries in the walk lane is covered by a journey row or extended by a
    // secondary one; a plan that simply drops it re-defers a journey nobody agreed to stop walking.
    const { product, featureId } = await ledgerKeyOf(branchDir);
    if (product && featureId) {
      const open = await openUnchecked(uncheckedRoot ?? hostRootOf(root), product, featureId);
      errors.push(...planUncheckedErrors(open, units, laneOfPlan(OPERATOR), UNITS));
    }
    for (const id of byId.keys()) if (!flowIds.has(id)) errors.push(`${UNITS}: unit ${id} has no Flows row; a flow nobody can read in the plan is a flow nobody planned`);
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateUatPlanStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid uat.plan branch\n');
}
