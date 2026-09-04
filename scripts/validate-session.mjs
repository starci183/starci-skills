// One session as a whole, checked by the orchestrator after every transition and by a person reading
// a session folder: state.json against its schema; from the first transition on, the brief and the
// budget are present and the brief's report is one of the declared shapes; no branch the chain moved
// past was abandoned without a receipt (a request with no response, or a response still carrying the
// dispatch skeleton, is RECEIPT_MISSING); the chain stays inside its budget; a stopped or blocked
// session names where it stopped; a session that writes routed source or touches a runtime carries a
// mission whose latest version the person confirmed as-stated, every earlier version left its own
// goal-confirm choice behind, and every change of goal is a replanned transition with its note and
// goalVersion, never a silent rewrite. The per-branch gates stay in validate-request and
// validate-response; this file reads only the ledger they leave behind.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from './json-schema.mjs';
import { effectiveBudget, missionGateErrors, goalDecisionId } from './validate-request.mjs';
import { loadOperatorPackages } from './operator-md.mjs';
import { loadInteractionPolicy } from './validate-interaction.mjs';

const branchDir = (session, branch) => { const [n, m] = branch.split('/'); return path.join(session, `step-${n}`, `parallel-${m}`); };
const stepOf = (branch) => Number(branch.split('/')[0]);

// The mission's version history, read from the ledger: a version below the current one was answered
// (corrected, or as-stated and then replanned), the current one is as-stated (missionGateErrors), and
// a version that superseded a confirmed one was reached through a replanned transition naming it.
export function missionHistoryErrors(state) {
  const errors = [];
  const mission = state?.mission;
  const transitions = state?.transitions ?? [];
  const replans = transitions.filter((t) => t.event === 'replanned');
  if (!mission) {
    if (replans.length) errors.push('state.json: a replanned transition names a mission version, but the session carries no mission');
    return errors;
  }
  for (const t of replans) if (t.goalVersion > mission.version) errors.push(`state.json: a replanned transition moves to goal version ${t.goalVersion}, past mission.version ${mission.version}`);
  for (let v = 1; v < mission.version; v += 1) {
    const id = goalDecisionId(state.id, v);
    const choice = state.choices?.[id];
    if (!choice) { errors.push(`state.json: mission version ${v} left no choices["${id}"]; every version the person was asked stays on record`); continue; }
    if (choice.selected === 'as-stated' && !replans.some((t) => t.goalVersion === v + 1)) errors.push(`state.json: mission version ${v} was confirmed as-stated and version ${v + 1} replaced it with no replanned transition carrying goalVersion ${v + 1}; a change of goal is a replan on record, never a silent rewrite`);
  }
  return errors;
}

export async function validateSession(root, session) {
  const errors = [];
  const stateFile = path.join(session, 'state.json');
  if (!existsSync(stateFile)) return { errors: ['state.json: missing'], state: null };
  let state; try { state = JSON.parse(await readFile(stateFile, 'utf8')); } catch (e) { return { errors: [`state.json: ${e.message}`], state: null }; }
  errors.push(...validateAgainst(JSON.parse(await readFile(path.join(root, 'templates', 'step', 'state.schema.json'), 'utf8')), state, 'state.json'));
  const live = (state.transitions ?? []).length > 0;
  if (live) {
    if (!state.brief) errors.push('state.json: a session with a transition carries brief');
    if (!state.budget) errors.push('state.json: a session with a transition carries budget');
  }
  const policy = await loadInteractionPolicy(root);
  // A chain that writes routed source or touches a runtime ran on a goal the person confirmed, and every change of that goal is on record.
  errors.push(...missionGateErrors(state, null, await loadOperatorPackages(root), policy));
  errors.push(...missionHistoryErrors(state));
  if (state.brief?.report) {
    const shapes = Object.keys(policy.reportShapes ?? {});
    if (!shapes.includes(state.brief.report.shape)) errors.push(`state.json: brief.report.shape ${state.brief.report.shape} is not one of ${shapes.join(', ')}`);
  }
  // Every branch the chain lists is either ahead of the current one, or has a receipt that is not the skeleton.
  const current = state.current ? stepOf(state.current) : 0;
  for (const branch of Object.keys(state.steps ?? {})) {
    const dir = branchDir(session, branch);
    const hasRequest = existsSync(path.join(dir, 'request', 'request.json'));
    const responseFile = path.join(dir, 'response', 'response.json');
    if (!hasRequest) continue;
    if (stepOf(branch) >= current) continue;
    if (!existsSync(responseFile)) { errors.push(`step-${branch.replace('/', '/parallel-')}: dispatched and passed with no response.json (RECEIPT_MISSING); a branch the chain moved past owes a receipt`); continue; }
    try { if (JSON.parse(await readFile(responseFile, 'utf8')).status === 'running') errors.push(`step-${branch.replace('/', '/parallel-')}: still carries the dispatch skeleton (RECEIPT_MISSING) while the chain moved past it`); }
    catch (e) { errors.push(`step-${branch.replace('/', '/parallel-')}: response.json ${e.message}`); }
  }
  const caps = effectiveBudget(state);
  if (caps) {
    const steps = Object.keys(state.steps ?? {}).map(stepOf);
    const top = steps.length ? Math.max(...steps) : 0;
    if (top > caps.maxSteps) errors.push(`state.json: the chain reaches step ${top}, past budget.maxSteps ${caps.maxSteps} (BUDGET_EXHAUSTED)`);
    const perOperator = new Map();
    for (const [branch, op] of Object.entries(state.steps ?? {})) perOperator.set(op, (perOperator.get(op) ?? new Set()).add(stepOf(branch)));
    for (const [op, set] of perOperator) if (set.size > caps.maxSameOperator) errors.push(`state.json: ${op} runs in ${set.size} steps, past budget.maxSameOperator ${caps.maxSameOperator} (BUDGET_EXHAUSTED)`);
  }
  if ((state.status === 'stopped' || state.status === 'blocked') && !state.stoppedAt) errors.push(`state.json: status ${state.status} names no stoppedAt`);
  if (state.status === 'running' && state.stoppedAt) errors.push('state.json: a running session carries no stoppedAt');
  return { errors, state };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node scripts/validate-session.mjs <session>\n'); process.exit(2); }
  validateSession(root, path.resolve(target)).then(({ errors }) => {
    if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('session valid\n');
  }, (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
