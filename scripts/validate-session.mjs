// One session as a whole, checked by the orchestrator after every transition and by a person reading
// a session folder: state.json against its schema; from the first transition on, the brief and the
// budget are present and the brief's report is one of the declared shapes; no branch the chain moved
// past was abandoned without a receipt (a request with no response, or a response still carrying the
// dispatch skeleton, is RECEIPT_MISSING); the chain stays inside its budget; a stopped or blocked
// session names where it stopped; a session that writes routed source or touches a runtime carries a
// mission whose latest version the person confirmed as-stated, every earlier version left its own
// goal-confirm choice behind, and every change of goal is a replanned transition with its note and
// goalVersion, never a silent rewrite; on such a session brief.proven cites only done-when lines a
// validator-accepted goalCheck evidenced, three consecutive done branches that served a done-when
// line and evidenced none stop the chain, and every transition was printed as the two-line log; and
// the chain itself — planned by scripts/plan-chain.mjs, replanned on every stop — passes
// scripts/validate-chain.mjs against the operator tables and each branch's request. The per-branch
// gates stay in validate-request and validate-response; this file reads only the ledger they leave
// behind.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from './json-schema.mjs';
import { effectiveBudget, missionGateErrors, goalDecisionId } from './validate-request.mjs';
import { goalCheckErrors } from './validate-response.mjs';
import { loadOperatorPackages } from './operator-md.mjs';
import { loadInteractionPolicy } from './validate-interaction.mjs';
import { validateChain, loadOperatorGraph, loadMaxParallel, readBranchRequests, readImportedInputs, readImportedSlots } from './validate-chain.mjs';
import { extractFindings, readLedger, LEDGER_DIR, LEDGER_OPERATORS } from './record-findings.mjs';

const branchDir = (session, branch) => { const [n, m] = branch.split('/'); return path.join(session, `step-${n}`, `parallel-${m}`); };
const stepOf = (branch) => Number(branch.split('/')[0]);
const parallelOf = (branch) => Number(branch.split('/')[1]);
const byChainOrder = (a, b) => stepOf(a) - stepOf(b) || parallelOf(a) - parallelOf(b);
async function readJson(file) { if (!existsSync(file)) return null; try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; } }

// The goal ledger of a mission session, read from each branch's request and response: which done-when
// line the branch served, whether its receipt is done, and whether it carries a goalCheck the response
// gate accepts with achieved true. Only that last kind of branch proves a line.
export async function goalLedger(session, state) {
  const out = [];
  for (const branch of Object.keys(state?.steps ?? {}).sort(byChainOrder)) {
    const dir = branchDir(session, branch);
    const request = await readJson(path.join(dir, 'request', 'request.json'));
    const response = await readJson(path.join(dir, 'response', 'response.json'));
    const goal = request?.goal ?? null;
    const done = response?.status === 'done';
    const accepted = done && response.goalCheck !== undefined && goalCheckErrors(dir, response, goal).length === 0;
    out.push({ branch, operator: state.steps[branch], doneWhen: goal?.doneWhen ?? null, done, achieved: accepted && response.goalCheck.achieved === true });
  }
  return out;
}
// brief.proven on a mission session cites done-when lines and nothing else: every entry opens with
// "doneWhen:<n> " and that n has a done branch whose validator-accepted goalCheck says achieved.
export function provenErrors(state, ledger) {
  const errors = [];
  if (!state?.mission) return errors;
  const lines = state.mission.doneWhen ?? [];
  for (const entry of state.brief?.proven ?? []) {
    const m = /^doneWhen:(\d+) /.exec(entry);
    if (!m) { errors.push(`state.json: brief.proven "${entry.slice(0, 60)}" cites no done-when line; on a mission every proven entry opens with "doneWhen:<n> " and only a validator-accepted goalCheck puts it there`); continue; }
    const n = Number(m[1]);
    if (!lines[n]) { errors.push(`state.json: brief.proven cites doneWhen:${n}, which the mission does not have (${lines.length} lines)`); continue; }
    if (!ledger.some((b) => b.doneWhen === n && b.achieved)) errors.push(`state.json: brief.proven cites doneWhen:${n} ("${lines[n].evidence}") and no done branch carries a validator-accepted goalCheck with achieved true for it; what no receipt evidenced is not proven`);
  }
  return errors;
}
// The stop signal: three consecutive done branches, in chain order, that served a done-when line and
// evidenced none is a chain that is busy without getting closer; the orchestrator stops and asks the
// person rather than dispatching a fourth. A prerequisite branch (a bind, a preflight, a gate that
// enables a later branch) never evidences a done-when line by design and is not counted. The error
// names the three branches.
export function threeBranchStopErrors(state, ledger) {
  const errors = [];
  if (!state?.mission) return errors;
  let run = [];
  for (const b of ledger.filter((x) => x.done && x.doneWhen !== null)) {
    if (b.achieved) { run = []; continue; }
    run.push(b);
    if (run.length === 3) errors.push(`state.json: three consecutive done branches evidenced no done-when line — ${run.map((x) => `${x.branch} ${x.operator}`).join(', ')}; the chain stops here and the person is asked, never a fourth branch dispatched`);
  }
  return errors;
}
// On a mission every transition was printed to the person as the two-line log (resources/interaction.json#transitionLog) and says so.
export function loggedErrors(state) {
  const errors = [];
  if (!state?.mission) return errors;
  (state.transitions ?? []).forEach((t, i) => { if (t.logged !== true) errors.push(`state.json: transitions[${i}] (${t.branch} ${t.event}) is not logged; on a mission every transition is printed to the root chat as the two lines interaction.json#transitionLog declares and recorded with logged: true`); });
  return errors;
}

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

// The findings ledger (knowledge/findings/INDEX.md): every done audit or walk branch whose verdicts
// carry a failure has its findings in the family's ledger, appended by scripts/record-findings.mjs at
// the transition that accepted the receipt. A done branch with failures the ledger does not hold is a
// receipt that was accepted and forgotten, and the error names the branch. A branch with no verdicts
// or no failure owes nothing; a branch whose family cannot be resolved cannot be recorded, and says so.
export async function findingsLedgerErrors(root, session, state, { ledgerDir = path.join(root, LEDGER_DIR) } = {}) {
  const errors = [];
  for (const branch of Object.keys(state?.steps ?? {}).sort(byChainOrder)) {
    const operator = state.steps[branch];
    if (!LEDGER_OPERATORS.has(operator)) continue;
    const dir = branchDir(session, branch);
    const response = await readJson(path.join(dir, 'response', 'response.json'));
    if (response?.status !== 'done') continue;
    let found = null;
    try { found = await extractFindings(dir, { root }); } catch (e) { errors.push(`step-${branch.replace('/', '/parallel-')}: ${e.message}`); continue; }
    if (!found || !found.lines.length) continue;
    const at = `step-${branch.replace('/', '/parallel-')}`;
    if (!found.family) { errors.push(`${at}: a done ${operator} branch carries ${found.lines.length} finding(s) and no family to record them under; the request binds no @knowledge/grammars/<family> and the route names no grammarId, so the ledger cannot hold them`); continue; }
    const ledger = await readLedger(path.join(ledgerDir, `${found.family}.jsonl`));
    const missing = found.lines.filter((l) => !ledger.latest.has(l.id));
    if (missing.length) errors.push(`${at}: a done ${operator} branch carries ${missing.length} finding(s) the ledger knowledge/findings/${found.family}.jsonl does not hold (${missing.map((l) => l.id).join(', ')}); every done audit or walk with a failing verdict appends its findings (node scripts/record-findings.mjs ${at})`);
  }
  return errors;
}

export async function validateSession(root, session, { packages = null, ledgerDir } = {}) {
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
  packages ??= await loadOperatorPackages(root);
  // A chain that writes routed source or touches a runtime ran on a goal the person confirmed, and every change of that goal is on record.
  errors.push(...missionGateErrors(state, null, packages, policy));
  errors.push(...missionHistoryErrors(state));
  // The chain is lawful against the operator tables and each branch's request: reachable, fed (by an earlier step or an accepted imported slot), bound (by a written or a planned bind), capped, proved, ended, and on a mission every branch names its goal.
  const byBranch = await readBranchRequests(session, state.steps);
  const graph = await loadOperatorGraph(root, packages);
  errors.push(...validateChain(root, packages, state.chain, state.steps, byBranch, { graph, mission: state.mission ?? null, maxParallel: await loadMaxParallel(root), planned: state.planned ?? {}, imported: await readImportedInputs(root, session, byBranch, { planned: state.planned ?? {} }), evidenceCells: (await readImportedSlots(session, graph, root)).map((s) => s.cell) }));
  // On a mission: proven cites only evidenced done-when lines, three unevidenced done branches in a row stop the chain, every transition was logged.
  const ledger = await goalLedger(session, state);
  errors.push(...provenErrors(state, ledger));
  errors.push(...threeBranchStopErrors(state, ledger));
  errors.push(...loggedErrors(state));
  // Every done audit or walk with a failing verdict left its findings in the family's ledger.
  errors.push(...await findingsLedgerErrors(root, session, state, ledgerDir ? { ledgerDir } : {}));
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
