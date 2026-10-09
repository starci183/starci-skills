// roles-standard.mjs — the role standard of modules/kernel/roles.yaml (`standard:`) checked per role: which requirement each
// of the five roles meets (present), lacks (missing) or has not yet built (pending, with the lane that builds it). A missing
// requirement is a finding; a pending entry is a finding once its requirement is present or when it names no lane and date.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { pendingFor } from './roles-table.mjs';
import { NOTICE_EVENT } from '../machine/revision-notice.mjs';

const POLICY_FILE = 'modules/kernel/op-incident-policy.yaml';
const COMMAND_POLICY_FILE = 'modules/kernel/command-policy.yaml';
const REGISTRY_FILE = 'modules/reconciler/edge-cases.yaml';
const SCOPE_TABLE = 'modules/kernel/revision-scope.yaml';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const present = (value) => value !== undefined && value !== null && !(typeof value === 'string' && !value.trim()) && !(Array.isArray(value) && !value.length);

const readYaml = (root, file) => parseYaml(fs.readFileSync(path.join(root, file), 'utf8'));

/** The ids a happy error may name: a row, a hold or a gate cause of the incident policy. */
function policyIds(root) {
  const policy = readYaml(root, POLICY_FILE);
  return new Set([...(policy.rows ?? []), ...(policy.holds ?? []), ...(policy.gateCauses ?? [])].map((entry) => entry.id));
}

/** The ids of the registry entries that are open: what a pending entry may name instead of a lane. */
const openEntries = (root) => new Set((readYaml(root, REGISTRY_FILE).cases ?? []).filter((entry) => entry.status === 'open').map((entry) => entry.id));

const boundRoles = (root) => new Set(readYaml(root, COMMAND_POLICY_FILE).roles?.bound ?? []);
const fileOf = (ref) => String(ref).split('#')[0];

function happyProblem(role, ctx) {
  if (!present(role.happyErrors)) return 'declares no happyErrors';
  const bad = role.happyErrors.filter((error) => !present(error.id) || !present(error.what) || !ctx.policy.has(error.row));
  return bad.length ? `happyErrors ${bad.map((error) => error.id ?? '?').join(', ')} name no row, hold or gate cause of ${POLICY_FILE}` : null;
}

function bugProblem(role, ctx) {
  if (!present(role.bugSurface)) return 'declares no bugSurface';
  const bad = role.bugSurface.filter((entry) => !present(entry.bug) || !present(entry.signal) || !fs.existsSync(path.join(ctx.root, fileOf(entry.detectedBy))));
  return bad.length ? `bugSurface entries without a bug, a signal or an existing detectedBy file: ${bad.map((entry) => entry.detectedBy ?? '?').join(', ')}` : null;
}

function fieldsProblem(role, ctx) {
  const missing = ctx.doc.standard.fields.filter((field) => !present(role[field]) && !(Array.isArray(role[field]) && ['cleanup', 'overseenBy'].includes(field)));
  return missing.length ? `lacks ${missing.join(', ')}` : null;
}

const blockProblem = (role, ctx) => (role.surfaces?.some((surface) => surface.mode === 'block' && fs.existsSync(path.join(ctx.root, surface.file)))
  ? null : 'has no existing surface in block mode');

function guardProblem(role, ctx) {
  if (role.noSeat === true) return typeof role.noSeatReason === 'string' && role.noSeatReason.trim().length >= 20 ? null : 'declares noSeat without a noSeatReason that says why it has no bound terminal';
  return ctx.bound.has(role.guard?.role) ? null : `names no guard role of ${COMMAND_POLICY_FILE} roles.bound (and is not noSeat)`;
}

function budgetProblem(role) {
  if (Number(role.tokenBudget?.perAttempt?.default) > 0 || (Number(role.wakeBudget?.perWake?.tokens) > 0 && Number(role.wakeBudget?.perWake?.turns) > 0)) return null;
  return typeof role.noBudget === 'string' && role.noBudget.trim().length >= 10 ? null : 'declares no tokenBudget, wakeBudget or noBudget reason';
}

function chainProblem(role, ctx) {
  const { chain } = ctx.doc;
  const stands = chain.reports.includes(role.id) || role.id in chain.attached || role.id in chain.besides;
  return stands ? null : 'stands nowhere in the reporting chain';
}

const longEnough = (text, min) => typeof text === 'string' && text.trim().length >= min;

/** The revisionAck declaration: a seated role names the verb and event that attest a runtime revision change, an Op or Critic the admission that fixes its rules, Debug why it has none. */
function revisionAckProblem(role, ctx) {
  const decl = role.revisionAck;
  if (!decl || typeof decl !== 'object') return 'declares no revisionAck';
  if (decl.noAck !== undefined) return longEnough(decl.noAck, 20) ? null : 'declares revisionAck.noAck without the reason it has none';
  if (!ctx.scopeRoles.includes(decl.scope)) return `revisionAck.scope ${decl.scope ?? '(none)'} is not a role of modules/kernel/revision-scope.yaml`;
  if (decl.admission === true) return longEnough(decl.reason, 20) ? null : 'declares revisionAck.admission without the reason';
  if (!fs.existsSync(path.join(ctx.root, String(decl.file ?? ''))) || !longEnough(decl.verb, 8)) return 'revisionAck names no existing verb file';
  return decl.event === NOTICE_EVENT ? null : `revisionAck.event must be ${NOTICE_EVENT}`;
}

const CHECKS = { 'revision-ack': revisionAckProblem, fields: fieldsProblem, 'happy-errors': happyProblem, 'bug-surface': bugProblem, 'prompt-block': blockProblem,
  'guard-binding': guardProblem, budget: budgetProblem, chain: chainProblem };

function pendingProblems(role, problems, known, openEntries) {
  const issues = [];
  for (const entry of role.pending ?? []) {
    if (!(present(entry.lane) || present(entry.entry)) || !DATE.test(String(entry.since ?? ''))) issues.push(`pending entry ${JSON.stringify(entry.requirements)} names no lane or registry entry, or no ISO date`);
    if (present(entry.entry) && !openEntries.has(entry.entry)) issues.push(`pending entry ${entry.entry} is not an open entry of ${REGISTRY_FILE}`);
    for (const id of entry.requirements ?? []) {
      if (!known.includes(id)) issues.push(`pending names the unknown requirement ${id}`);
      else if (!problems[id]) issues.push(`pending names ${id}, which the role already meets: remove the entry`);
    }
  }
  return issues;
}

const cellOf = (role, id, problem) => {
  if (!problem) return 'present';
  return pendingFor(role, id) ? 'pending' : 'missing';
};

/** One role's standing: {id, cells: {requirement: present|pending|missing}, problems, issues}. */
function standingOf(role, ctx) {
  const known = Object.keys(ctx.doc.standard.requirements);
  const problems = Object.fromEntries(known.map((id) => [id, CHECKS[id](role, ctx)]));
  const cells = Object.fromEntries(known.map((id) => [id, cellOf(role, id, problems[id])]));
  return { id: role.id, cells, problems, issues: pendingProblems(role, problems, known, ctx.open) };
}

/** The standing of every role of `doc.standard.roles` in the tree at `root`: [{id, cells, problems, issues}]. */
export function roleStandings(doc, root) {
  const ctx = { doc, root, policy: policyIds(root), bound: boundRoles(root), open: openEntries(root), scopeRoles: readYaml(root, SCOPE_TABLE).roleIds };
  return doc.standard.roles.map((id) => standingOf(doc.roles.find((role) => role.id === id), ctx));
}

/** The role x requirement table the check prints. */
export function renderStandingTable(doc, standings) {
  const known = Object.keys(doc.standard.requirements);
  const rows = standings.map((standing) => {
    const role = doc.roles.find((entry) => entry.id === standing.id);
    return [role.label, ...known.map((id) => {
      const cellState = standing.cells[id];
      return cellState === 'pending' ? `pending (${pendingFor(role, id).lane ?? pendingFor(role, id).entry})` : cellState;
    })];
  });
  const widths = ['Role', ...known].map((title, column) => Math.max(title.length, ...rows.map((row) => row[column].length)));
  const line = (row) => row.map((value, column) => value.padEnd(widths[column])).join('  ').trimEnd();
  return [line(['Role', ...known]), line(widths.map((width) => '-'.repeat(width))), ...rows.map(line)].join('\n');
}

/** The finding messages of the standings: a missing requirement and an unsound pending entry. */
export function standingMessages(standings) {
  return standings.flatMap((standing) => [
    ...Object.entries(standing.cells).filter(([, state]) => state === 'missing').map(([id]) => `role ${standing.id} lacks the standard requirement ${id}: ${standing.problems[id]} (build it, or mark it pending with the lane that owns it)`),
    ...standing.issues.map((issue) => `role ${standing.id}: ${issue}`)]);
}
