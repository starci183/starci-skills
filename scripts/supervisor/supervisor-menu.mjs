// supervisor-menu.mjs — the Supervisor's menu: the judgment points waiting on the Supervisor, each with the typed options that answer
// it. Pure over its sources (scripts/supervisor/supervisor-menu-sources.mjs reads the Decision Items); the kinds, options and routing
// are data in modules/supervisor/supervisor-menu.yaml. The menu adds no policy: a gate is answered with the typed resolutions of
// modules/kernel/op-incident-policy.yaml, and nothing on it changes the runtime.
import fs from 'node:fs';
import { escapeOptionOf, fillTemplate } from '../lib/menu-parts.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { clipLine } from '../lib/clip.mjs';
import { seatCostConfig } from '../kernel/seat-wakes.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let cached = null;
const SUBJECT_TOKEN = /\$(\w+)/g;
// The caller's inputs: `starci supervisor decide` binds them when it runs the steps.
const CALLER_TOKENS = new Set(['text', 'reason']);

/** The menu catalog (modules/supervisor/supervisor-menu.yaml). */
const supervisorMenuCatalog = () => (cached ??= parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'supervisor', 'supervisor-menu.yaml'), 'utf8')));

/** A step argument with the item's subject bound; a caller token stays as written, an unknown subject value drops the flag (null). */
function bindValue(raw, subject) {
  if (typeof raw !== 'string') return raw;
  let dropped = false;
  const bound = raw.replace(SUBJECT_TOKEN, (match, name) => {
    if (CALLER_TOKENS.has(name)) return match;
    const value = subject[name];
    if (value == null || value === '') dropped = true;
    return String(value ?? '');
  });
  return dropped ? null : bound;
}

/** The arguments of a step bound to the subject. */
function resolveSupervisorArgs(args, subject) {
  const out = {};
  for (const [key, raw] of Object.entries(args ?? {})) {
    const value = bindValue(raw, subject);
    if (value != null && value !== '') out[key] = value;
  }
  return out;
}

const optionOf = (spec, subject) => {
  const steps = (spec.steps ?? []).map((step) => ({ run: step.run, args: resolveSupervisorArgs(step.args, subject) }));
  return { choice: spec.choice, steps, effect: fillTemplate(spec.effect, subject), ...(spec.text ? { text: spec.text } : {}), ...(spec.keepsOpen ? { keepsOpen: true } : {}) };
};

const escapeOption = () => escapeOptionOf(supervisorMenuCatalog().escape);

const routeMatches = (entry, di) => entry.default === true || (entry.when === 'gateIncident' ? Boolean(di.refs?.gateIncident)
  : (entry.diKinds ?? []).includes(di.kind) || (entry.keyPrefix !== undefined && String(di.idempotencyKey ?? '').startsWith(entry.keyPrefix)));

/** The kind id the Decision Item `di` belongs to, by the routes of the catalog. */
function kindOfItem(di) {
  return supervisorMenuCatalog().routes.find((entry) => routeMatches(entry, di)).kind;
}

const subjectOf = (di, ledger) => {
  const { priority } = supervisorMenuCatalog();
  return { key: di.id, di: di.id, workflow: di.workflowId ?? di.productWorkflowId ?? null, repo: ledger?.repoRoot ?? null, incident: di.refs?.gateIncident ?? null, diKind: di.kind,
    summary: clipLine(di.summary, 400), refs: `di:${di.id}`, weight: priority.weight, reserve: priority.reserve };
};

/** One menu item for a Decision Item and its ledger ({repoRoot}|null). */
export function menuItemOf(di, ledger) {
  const kind = kindOfItem(di);
  const spec = supervisorMenuCatalog().kinds.find((entry) => entry.id === kind);
  const subject = subjectOf(di, ledger);
  return { id: `${kind}:${di.id}`, kind, subject, question: fillTemplate(spec.question, subject), options: [...spec.options.map((option) => optionOf(option, subject)), escapeOption()],
    evidence: [{ ref: `decision:${di.id}` }, ...(di.evidence ?? []).slice(0, 6)], deadline: di.dueAt ?? null, di: di.id, severity: di.severity ?? 'normal' };
}

const urgency = (a, b) => (b.severity === 'critical') - (a.severity === 'critical') || (a.deadline ?? Infinity) - (b.deadline ?? Infinity) || a.id.localeCompare(b.id);

/** The menu over the live Supervisor Decision Items: [{id, kind, subject, question, options, evidence, deadline, di}], critical first, then by deadline. */
export const buildSupervisorMenu = (items) => items.map(({ di, ledger }) => menuItemOf(di, ledger)).sort(urgency);

const optionLine = (option) => [option.choice, option.text ? `--text <${option.text}>` : null].filter(Boolean).join(' ');

/** The menu as the lines the seat reads: each item, its options and the decision verb's spelling. */
export function supervisorMenuLines(menu) {
  if (!menu.length) return ['Decide (0): nothing waits on the Supervisor; yield until the runtime wakes it.'];
  const cap = seatCostConfig().statusBounds.supervisorMenuItems;
  return [`Decide (${menu.length}): answer with starci supervisor decide --item <id> --choice <choice> --reason <why> [--text <input>]`,
    ...menu.slice(0, cap).flatMap((item) => [` ${item.id} [${item.kind}] ${clipLine(item.question, 160)}`, `   choices: ${item.options.map(optionLine).join(' | ')}`]),
    ...(menu.length > cap ? [` +${menu.length - cap} more item(s): answer these first, then read the next with starci supervisor status`] : [])];
}
