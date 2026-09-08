// The unchecked ledger, read and written. A mission's verification covers the surfaces its done-when
// journey passes through and nothing else; every unit the journey does not reach is tiered
// `secondary` by the plan that named it, is never dispatched to a verifying operator, and is written
// down here as unchecked. The ledger is what makes that lawful rather than silent: an entry outlives
// the session that left it unchecked, the plan of the next mission reads it back, and a lane that
// finally covers what an entry names resolves the line.
//
// One file per product and feature, @worktrees/unchecked/<product>/<featureId>.jsonl, append-only, one
// JSON object per line against templates/kinds/unchecked.schema.json. No line is ever edited: an entry
// is resolved by appending the same id with resolvedBy and resolvedAt filled, so the newest line per
// id is that entry's state, exactly as knowledge/findings/<family>.jsonl works for findings.
//
// This module is the one home of two facts the rest of the tree reads rather than restates: which
// operator proves which lane (VERIFY_LANES), and how an entry's id is derived from what it is about.
import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from './json-schema.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const UNCHECKED_SCHEMA = path.join('templates', 'kinds', 'unchecked.schema.json');
// The alias @worktrees/unchecked, as a path under the host root; alias/alias.json is where it is declared.
export const LEDGER_DIR = path.join('.worktrees', 'unchecked');
// Everything below takes `hostRoot`, the host repository that owns this tree (scripts/validate-request.mjs#hostRootOf):
// the ledger lives beside the tree under @worktrees/unchecked, never inside it, exactly as the business heads and the UAT
// pairs do, because an entry outlives the tree version that recorded it.

// The operators that prove a unit, and the lane each one proves. A unit no lane covers is unchecked in
// that lane; an operator absent from this map verifies nothing and takes every unit the plan lists,
// because generation scope is the person's goal and only proof is narrowed to the journey.
export const VERIFY_LANES = Object.freeze({
  'interface.audit': 'audit',
  'uat.verify': 'walk',
  'api.verify': 'e2e',
});
export const verifiesUnits = (operatorId) => Object.hasOwn(VERIFY_LANES, operatorId);
export const laneOf = (operatorId) => VERIFY_LANES[operatorId] ?? null;

// A unit's tier, with the schema's default applied: a plan written before the field carried one is
// read as journey, so an older list stays fully verified rather than silently narrowed. The default is
// read out of the kind that publishes it rather than repeated here, so changing the schema changes the
// gate and there is no second place to forget.
export const UNITS_SCHEMA = path.join('templates', 'kinds', 'units.schema.json');
export const DEFAULT_TIER = JSON.parse(readFileSync(path.join(ROOT, UNITS_SCHEMA), 'utf8')).$defs.tier.default;
export const tierOf = (unit) => unit?.tier ?? DEFAULT_TIER;
export const isJourney = (unit) => tierOf(unit) === 'journey';
export const journeyUnits = (doc) => (doc?.units ?? []).filter(isJourney);
export const secondaryUnits = (doc) => (doc?.units ?? []).filter((u) => !isJourney(u));

export const ledgerFile = (hostRoot, product, featureId) => path.join(hostRoot, LEDGER_DIR, product, `${featureId}.jsonl`);

export function uncheckedId({ product, featureId, unit, state, lane }) {
  const digest = createHash('sha256').update(JSON.stringify([product, featureId, unit, state ?? null, lane])).digest('hex');
  return `u${digest.slice(0, 12)}`;
}

export async function loadUncheckedSchema(root = ROOT) {
  return JSON.parse(await readFile(path.join(root, UNCHECKED_SCHEMA), 'utf8'));
}
export function uncheckedErrors(schema, line, at = 'unchecked') {
  return validateAgainst(schema, line, at);
}

// Every line of one ledger as written, and the newest line per id. A ledger that does not exist is an
// empty one: a feature nothing was ever left unchecked on is not a broken feature.
export async function readUnchecked(hostRoot, product, featureId) {
  const file = ledgerFile(hostRoot, product, featureId);
  const lines = [];
  if (existsSync(file)) {
    for (const raw of (await readFile(file, 'utf8')).split(/\r?\n/)) {
      const text = raw.trim();
      if (!text) continue;
      try { lines.push(JSON.parse(text)); } catch { throw new Error(`${file}: a line is not JSON`); }
    }
  }
  const latest = new Map();
  for (const line of lines) latest.set(line.id, line);
  return { file, lines, latest };
}

export async function openUnchecked(hostRoot, product, featureId) {
  const ledger = await readUnchecked(hostRoot, product, featureId);
  return [...ledger.latest.values()].filter((d) => d.resolvedBy === null);
}

// Append the lines the ledger does not already hold. An entry already open is not appended twice, and
// an entry already resolved is reopened by appending it again — the same id with resolvedBy null —
// because coverage that was taken and then dropped is unchecked again.
export async function appendUnchecked(hostRoot, product, featureId, lines, { schema = null, root = ROOT } = {}) {
  schema ??= await loadUncheckedSchema(root);
  const ledger = await readUnchecked(hostRoot, product, featureId);
  const toAppend = [];
  for (const line of lines) {
    const errors = uncheckedErrors(schema, line, `unchecked ${line.id}`);
    if (errors.length) throw new Error(errors.join('\n'));
    const current = ledger.latest.get(line.id);
    if (current && current.resolvedBy === null) continue;
    toAppend.push(line);
  }
  if (toAppend.length) {
    mkdirSync(path.dirname(ledger.file), { recursive: true });
    appendFileSync(ledger.file, toAppend.map((l) => JSON.stringify(l)).join('\n') + '\n');
  }
  return { file: ledger.file, appended: toAppend.length };
}

// Close every open entry whose id `ids` names, by appending the same line with the resolver on it.
export async function resolveUnchecked(hostRoot, product, featureId, ids, { resolvedBy, resolvedAt, schema = null, root = ROOT } = {}) {
  schema ??= await loadUncheckedSchema(root);
  const ledger = await readUnchecked(hostRoot, product, featureId);
  const wanted = new Set(ids);
  const toAppend = [];
  for (const entry of ledger.latest.values()) {
    if (!wanted.has(entry.id) || entry.resolvedBy !== null) continue;
    const line = { ...entry, recordedAt: entry.recordedAt, resolvedBy, resolvedAt };
    const errors = uncheckedErrors(schema, line, `unchecked ${line.id}`);
    if (errors.length) throw new Error(errors.join('\n'));
    toAppend.push(line);
  }
  if (toAppend.length) {
    mkdirSync(path.dirname(ledger.file), { recursive: true });
    appendFileSync(ledger.file, toAppend.map((l) => JSON.stringify(l)).join('\n') + '\n');
  }
  return { file: ledger.file, resolved: toAppend.length };
}

// The lines one plan leaves unchecked: one per secondary unit, in the lane its own domain proves. A
// plan names the tier and the reason; the lane comes from the verifying operator of that domain.
export function uncheckedOfPlan({ product, featureId, units, lane, recordedBy, recordedAt }) {
  return secondaryUnits(units).map((unit) => {
    const line = { product, featureId, unit: unit.id, state: null, lane, tier: 'secondary', reason: unit.deferral?.reason ?? '', recordedBy, recordedAt, resolvedBy: null, resolvedAt: null };
    return { ...line, id: uncheckedId(line) };
  });
}

// The lane a plan operator's units are proved in: the verifying operator of its own domain.
// `uat.plan` is checked by the walk, `interface.plan` by the audit; a domain with no verifying
// operator leaves nothing unchecked, because a lane nobody runs is not coverage anyone skipped.
const domainOf = (operatorId) => String(operatorId ?? '').split('.')[0];
export function laneOfPlan(planOperatorId) {
  const domain = domainOf(planOperatorId);
  for (const [operatorId, lane] of Object.entries(VERIFY_LANES)) if (domainOf(operatorId) === domain) return lane;
  return null;
}

// A plan states its tiering twice — as the Tier column a person reads and as the `tier` the fan-out
// gate reads — and the two are one statement. The column is `journey`, or `secondary — <reason>`
// carrying the unit's own deferral.reason verbatim, so a reader of the receipt learns what was left
// uncovered and why without opening the data. Both plan validators share this reading; the column's
// shape itself is the kind contract's.
export function tierErrors(rows, units, { at, table }) {
  const errors = [];
  const byId = new Map((units?.units ?? []).map((u) => [u.id, u]));
  for (const [id, cell] of rows) {
    const unit = byId.get(id);
    if (!unit) continue;
    const expected = isJourney(unit) ? 'journey' : `secondary — ${unit.deferral?.reason ?? ''}`;
    if (cell !== expected) errors.push(`${at}: ${table} row ${id} is tier ${JSON.stringify(cell)} and the unit list says ${JSON.stringify(expected)}; the tiering a person reads and the tiering the fan-out runs on are one statement`);
  }
  return errors;
}

// What is unchecked is consumed, not forgotten. A plan of a feature that already carries an open entry
// in its lane must say what happens to it: list the unit as `journey` and check it with the
// verification that follows, or list it as `secondary` and extend the entry with a reason of this
// plan's own. A plan that simply leaves the unit out re-defers it silently, which is the one thing the
// ledger exists to prevent.
export function planUncheckedErrors(open, units, lane, at = 'units.json') {
  const listed = new Set((units?.units ?? []).map((u) => u.id));
  const errors = [];
  for (const entry of open) {
    if (entry.lane !== lane || listed.has(entry.unit)) continue;
    errors.push(`${at}: the feature carries an open ${lane} entry on unit ${entry.unit} (${entry.reason}) and this plan does not list it; an open entry is covered by planning the unit as tier journey or extended by planning it as tier secondary with a reason, never dropped from the list`);
  }
  return errors;
}
