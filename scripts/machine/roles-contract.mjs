// roles-contract.mjs — reads the one roles contract (modules/kernel/roles.yaml) and renders a role's block: the Markdown a surface
// carries between its markers, and the compact lines the op prompt prints at launch. The roles-contract self-check compares
// every surface with this rendering.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ROLES_FILE = 'modules/kernel/roles.yaml';

/** The roles contract document of the tree at `root`. */
export const rolesContract = (root = ROOT) => parseYaml(fs.readFileSync(path.join(root, ROLES_FILE), 'utf8'));

export const markerOf = (id) => ({ begin: `<!-- roles:begin ${id} -->`, end: `<!-- roles:end ${id} -->` });

const bullets = (label, items) => (items?.length ? [`- ${label}:`, ...items.map((item) => `  - ${item}`)] : []);
const nameOf = (doc, id) => (id === 'runtime' ? 'the runtime' : doc.roles.find((role) => role.id === id)?.label ?? id);

/** The lines that state who a role reports to, who oversees it and what it owns. */
function chainLines(doc, role) {
  const up = role.reportsTo ? `${nameOf(doc, role.reportsTo)} (${role.reportsUpWhen})` : 'no one';
  return [`- Owns: ${role.owns}. Decides alone: ${role.decidesAlone}.`,
    `- Reports to: ${up}. Overseen by: ${role.overseenBy.map((id) => nameOf(doc, id)).join(', ') || 'no one'}.`,
    `- Measure: ${role.measure}.`];
}

/** The token budget line of a role that declares one. */
function budgetLines(role) {
  const b = role.tokenBudget;
  const wake = role.wakeBudget;
  if (b) return [`- Token budget (${b.status}): ${b.perAttempt.default} per ${b.unit ?? 'attempt'}; over it, ${b.onExceed}.`];
  if (wake) return [`- Wake budget (${wake.status}): ${wake.perWake.turns} turns and ${wake.perWake.tokens} tokens per wake; over it, ${wake.onExceed}.`];
  return role.noBudget ? [`- No budget: ${role.noBudget}.`] : [];
}

/** The guard binding, the happy errors and the bug surface of a role that declares them (the owner's two classes of error). */
function standardLines(role) {
  const unbound = role.noSeat ? [`- Guard: none by design; ${role.noSeatReason}.`] : [];
  const guard = role.guard ? [`- Guard: its terminals are bound as the "${role.guard.role}" role of modules/kernel/command-policy.yaml.`] : unbound;
  const happy = role.happyErrors?.map((error) => `${error.id} (policy row ${error.row}): ${error.what}`);
  const bugs = role.bugSurface?.map((entry) => `${entry.bug}: ${entry.signal}`);
  return [...guard, ...bullets('Happy errors it handles (the system working as designed, handled inside the chain through the policy)', happy),
    ...bullets('A bug in this role (the chain neither fixes nor works around it; Debug removes it with a change to .claude) is detected by', bugs)];
}

/** The Debug lines that state whom it audits and when it retires. */
function debugLines(doc, role) {
  if (!role.oversees) return [];
  const criteria = role.endCondition.criteria.map((c) => `${c.id}: ${c.rule}`);
  return [`- Audits: ${role.oversees.map((id) => nameOf(doc, id)).join(', ')}.`, ...bullets('Retires when', criteria)];
}

/** The Markdown block of one role (without its markers). */
export function renderRoleBlock(doc, id) {
  const role = doc.roles.find((entry) => entry.id === id);
  const lines = [`**${role.label}** (${ROLES_FILE}#${id}): ${role.scope}`, ...bullets('Does', role.does), ...bullets('Must clean up', role.cleanup),
    ...bullets('Never', role.never), ...chainLines(doc, role), ...budgetLines(role), ...standardLines(role), ...debugLines(doc, role), `- Principles: ${role.binds.join(' ')} (${ROLES_FILE}, principles).`];
  return lines.join('\n');
}

/** The compact lines of a role for a launch prompt. */
export function renderRoleLines(id, root = ROOT) {
  const doc = rolesContract(root);
  const role = doc.roles.find((entry) => entry.id === id);
  return [`role: ${role.label} (${ROLES_FILE}#${id}) - ${role.scope}`, ...role.never.map((item) => `  never: ${item}`),
    ...role.cleanup.map((item) => `  clean up: ${item}`), `  reports to: ${nameOf(doc, role.reportsTo)} only`];
}

/** The text with the role's block replaced between its markers, or appended with markers when it has none. */
export function withRoleBlock(text, doc, id) {
  const { begin, end } = markerOf(id);
  const block = `${begin}\n${renderRoleBlock(doc, id)}\n${end}`;
  const from = text.indexOf(begin);
  const to = text.indexOf(end);
  if (from < 0 || to < from) return `${text.trimEnd()}\n\n${block}\n`;
  return text.slice(0, from) + block + text.slice(to + end.length);
}
