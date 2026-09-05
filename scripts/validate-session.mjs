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
import { extractUnchecked, UNCHECKED_OPERATORS } from './record-unchecked.mjs';
import { budgetUnitsOf, hostRootOf, loadUnits } from './validate-request.mjs';
import { readUnchecked } from './unchecked.mjs';
import { readBank, currentApproval, sessionOf, canonical } from './bank.mjs';

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
// a version that superseded a confirmed one was reached through a replanned transition naming it. A
// replanned transition at the current version is a chain that changed under a goal that did not — a
// routed re-entry, a fan-out, a stop that added an operator — and asks the person nothing.
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

// The unchecked ledger (@worktrees/unchecked/<product>/<featureId>.jsonl, scripts/unchecked.mjs): every
// done branch that deferred coverage has its entries in the feature's ledger, appended by
// scripts/record-unchecked.mjs at the transition that accepted the receipt. A plan that tiered a unit
// `secondary`, or a verification whose receipt deferred a state, and a ledger that does not hold the
// matching lines, is a run that narrowed itself and left no trace of the narrowing — which is the one
// outcome the tiering exists to prevent. A branch that deferred nothing records nothing.
export async function uncheckedLedgerErrors(root, session, state, { hostRoot = hostRootOf(root) } = {}) {
  const errors = [];
  for (const branch of Object.keys(state?.steps ?? {}).sort(byChainOrder)) {
    const operator = state.steps[branch];
    if (!UNCHECKED_OPERATORS.has(operator)) continue;
    const dir = branchDir(session, branch);
    const response = await readJson(path.join(dir, 'response', 'response.json'));
    if (response?.status !== 'done') continue;
    const at = `step-${branch.replace('/', '/parallel-')}`;
    let found = null;
    try { found = await extractUnchecked(dir, { root, hostRoot }); } catch (e) { errors.push(`${at}: ${e.message}`); continue; }
    if (!found || !found.append.length) continue;
    const ledger = await readUnchecked(hostRoot, found.product, found.featureId);
    const missing = found.append.filter((d) => !ledger.latest.has(d.id));
    if (missing.length) errors.push(`${at}: a done ${operator} branch deferred ${missing.length} unit(s) or state(s) the ${found.lane} ledger of ${found.product}/${found.featureId} does not hold (${missing.map((d) => `${d.unit}${d.state ? `/${d.state}` : ''}`).join(', ')}); coverage that is not taken is written down (node scripts/record-unchecked.mjs ${at})`);
  }
  return errors;
}

// The fan-out is paid for by the units it runs, and it runs the journey. state.json.budget.units is
// how many units the latest plan produced that a verifying lane will actually be dispatched over —
// the journey units — so a mission that defers half its surfaces does not also carry the budget for
// verifying them (resources/orchestrator.json#budget, scripts/validate-request.mjs#effectiveBudget).
export async function unitBudgetErrors(root, session, state) {
  const errors = [];
  if (state?.budget?.units === undefined) return errors;
  let latest = null;
  for (const branch of Object.keys(state?.steps ?? {}).sort(byChainOrder)) {
    const file = path.join(branchDir(session, branch), 'response', 'data', 'units.json');
    if (!existsSync(file)) continue;
    const response = await readJson(path.join(branchDir(session, branch), 'response', 'response.json'));
    if (response?.status !== 'done') continue;
    latest = { branch, file };
  }
  if (!latest) return errors;
  const { units } = await loadUnits(root, latest.file, latest.file);
  if (!units) return errors;
  const expected = budgetUnitsOf(units);
  if (state.budget.units !== expected) errors.push(`state.json: budget.units is ${state.budget.units} and the plan of step-${latest.branch.replace('/', '/parallel-')} carries ${expected} journey unit(s) of ${units.units.length}; the step cap grows per unit a lane is dispatched over, and a deferred unit is unchecked rather than a branch`);
  // The scope line of the goal block, once a plan has said how far the verification reaches.
  const scope = state.mission?.scope;
  if (scope && (scope.journey !== expected || scope.deferred !== units.units.length - expected)) {
    errors.push(`state.json: mission.scope says ${scope.journey} journey and ${scope.deferred} deferred, and the plan of step-${latest.branch.replace('/', '/parallel-')} carries ${expected} and ${units.units.length - expected}; the scope line the person read is the plan's own count, not a second one`);
  }
  return errors;
}

// A mission opened from an approved bank (@worktrees/banked/<product>, scripts/bank.mjs): the person
// approved the whole queue once, and that one answer is the goal-confirm of every mission the queue
// listed — which is why such a session prints its goal block and does not wait. This is what keeps
// that shortcut honest. The goal-confirm choice is still recorded, exactly as any other mission's is
// (missionGateErrors), but its sourceRef names the approval rather than a message, and here that
// approval must actually be there: the entry exists and is not dropped, it names this session, the
// goal the session runs is the goal the bank carries word for word, and the approval still covers the
// bank as it stands. Correcting a goal at open time rewrites the bank entry, which changes the queue
// hash, which ends the approval — so a corrected mission is asked again by construction.
export async function bankRefErrors(state, { hostRoot = hostRootOf(process.cwd()) } = {}) {
  const ref = state?.mission?.bankRef;
  if (!ref) return [];
  const errors = [];
  const { product, missionId, approval } = ref;
  const at = `@worktrees/banked/${product}`;
  const bank = await readBank(hostRoot, product);
  if (!bank.queue) return [`state.json: mission.bankRef names ${at}, which carries no queue.json; a mission cannot be opened from a bank that is not there`];
  const entry = bank.queue.entries.find((e) => e.missionId === missionId);
  if (!entry) return [`state.json: mission.bankRef names ${missionId}, which ${at}/queue.json does not list`];
  if (entry.status === 'dropped') errors.push(`state.json: mission.bankRef names ${missionId}, which the bank dropped; a dropped mission is not taken`);
  else if (sessionOf(entry) !== state.id) errors.push(`state.json: ${at}/queue.json has ${missionId} at status ${entry.status} and this session is ${state.id}; the bank entry names the session that took it, and one mission of a product runs at a time`);
  const banked = bank.missions.get(missionId);
  if (!banked) errors.push(`${at}/${missionId}/mission.json: missing, and the session says it opened from it`);
  else {
    const draft = banked.goalDraft ?? {};
    const mission = state.mission;
    for (const field of ['goal', 'includes', 'excludes', 'doneWhen']) {
      if (canonical(draft[field]) !== canonical(mission[field])) errors.push(`state.json: mission.${field} is not what ${at}/${missionId}/mission.json banked; a mission opened from a bank runs the goal the person approved, and a corrected goal rewrites the bank entry and is confirmed again`);
    }
  }
  const current = currentApproval(bank.approvals, bank.hash);
  if (!current) errors.push(`${at}/approvals.json: no approval covers the bank as it stands (${bank.hash}); the queue was reordered, extended, dropped from or its missions edited since it was approved, so the person answers once more before another banked mission opens`);
  else if (current.choice !== approval) errors.push(`state.json: mission.bankRef names approval ${approval} and the current one is ${current.choice}`);
  else if (!current.missionIds.includes(missionId)) errors.push(`${at}/approvals.json: ${current.choice} does not list ${missionId}; an approval is the goal-confirm of exactly the missions it names`);
  const choice = state.choices?.[goalDecisionId(state.id, state.mission.version)];
  if (choice && !String(choice.sourceRef ?? '').includes(approval)) errors.push(`state.json: the goal-confirm of a banked mission carries the approval ${approval} as its sourceRef; that approval is the person's answer, and a session that claims one must name it`);
  return errors;
}

export async function validateSession(root, session, { packages = null, ledgerDir, uncheckedRoot } = {}) {
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
  // Every done plan or verification that deferred coverage left its entries in the feature's ledger, and
  // the fan-out budget counts the journey the mission actually verifies.
  errors.push(...await uncheckedLedgerErrors(root, session, state, uncheckedRoot ? { hostRoot: uncheckedRoot } : {}));
  errors.push(...await unitBudgetErrors(root, session, state));
  // A mission opened from an approved bank names an entry that is there, is its own, and is still covered.
  errors.push(...await bankRefErrors(state, { hostRoot: uncheckedRoot ?? hostRootOf(root) }));
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
