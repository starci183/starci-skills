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
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateAgainst } from './json-schema.mjs';
import { effectiveBudget, missionGateErrors, goalDecisionId, V22_CONTRACT } from './validate-request.mjs';
import { goalCheckErrors } from './validate-response.mjs';
import { loadOperatorPackages } from './operator-md.mjs';
import { loadInteractionPolicy } from './validate-interaction.mjs';
import { validateChain, loadOperatorGraph, loadMaxParallel, readBranchRequests, readImportedInputs, readImportedSlots } from './validate-chain.mjs';
import { extractFindings, readLedger, LEDGER_DIR, LEDGER_OPERATORS } from './record-findings.mjs';
import { extractUnchecked, UNCHECKED_OPERATORS } from './record-unchecked.mjs';
import { budgetUnitsOf, hostRootOf, loadUnits } from './validate-request.mjs';
import { readUnchecked } from './unchecked.mjs';
import { readBank, currentApproval, sessionOf, isDone, canonical } from './bank.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const STATE_SCHEMA = path.join('templates', 'step', 'state.schema.json');
const stateSchemas = new Map();

const expectedHash = (expected) => `sha256:${createHash('sha256').update(JSON.stringify(expected)).digest('hex')}`;

export async function v22SessionErrors(session, state) {
  const errors = [];
  if (state?.contractVersion !== V22_CONTRACT) return errors;
  const mission = state.mission ?? {};
  for (const field of ['target', 'outputs', 'verification', 'confirmation']) if (mission[field] === undefined) errors.push(`state.json: v2.2 mission.${field} is required by the scope table`);
  if (!path.isAbsolute(state.hostBinding?.worktree ?? '')) errors.push('state.json: hostBinding.worktree is not an absolute user worktree binding');
  if (state.hostBinding?.hostId === state.id) errors.push('state.json: hostBinding.hostId is the native Codex task or Claude session id, not the StarCi session id');
  const phase = state.lifecycle?.phase;
  if (phase === 'draft') {
    if ((state.chain ?? []).length || Object.keys(state.steps ?? {}).length || Object.keys(state.attempts ?? {}).length) errors.push('state.json: a draft session has no planned or dispatched operator work');
    if (Object.keys(state.leases ?? {}).length) errors.push('state.json: a draft session holds no worker or resource lease');
    if (mission.confirmation?.status === 'confirmed') errors.push('state.json: a confirmed mission is active, not draft');
  }
  if (phase === 'active') {
    const confirmation = mission.confirmation;
    if (confirmation?.status !== 'confirmed') errors.push('state.json: an active session carries a confirmed mission version');
    const choice = state.choices?.[confirmation?.decisionId];
    if (!choice || choice.selected !== 'as-stated' || choice.selectedBy !== 'user' || choice.sourceRef !== confirmation?.sourceRef) errors.push('state.json: mission.confirmation does not bind the matching explicit user goal-confirm choice');
  }
  if (phase === 'closed-success') {
    for (const field of ['closedAt', 'closeReason', 'compactRef']) if (!state.lifecycle?.[field]) errors.push(`state.json: lifecycle.${field} is required for closed-success`);
    if (Object.keys(state.leases ?? {}).length) errors.push('state.json: a closed-success session still holds worker leases');
  }
  const ids = new Set();
  for (const [branch, attempt] of Object.entries(state.attempts ?? {})) {
    if (ids.has(attempt.id)) errors.push(`state.json: attempt id ${attempt.id} is duplicated`);
    ids.add(attempt.id);
    if (state.steps?.[branch.replace(/\/[a-z][a-z-]*$/, '')] !== attempt.operatorId) errors.push(`state.json: attempts[${branch}] runs ${attempt.operatorId}, which state.steps does not own`);
    if (attempt.expectedHash !== expectedHash(attempt.expected)) errors.push(`state.json: attempts[${branch}].expected changed after dispatch; its expectedHash no longer matches`);
    const parts = branch.split('/');
    const refBase = `step-${parts[0]}/parallel-${parts[1]}${parts[2] ? `/${parts[2]}` : ''}`;
    const requiredRequestRef = `${refBase}/request/request.json`;
    const requiredResponseRef = `${refBase}/response/response.json`;
    if (attempt.requestRef !== requiredRequestRef) errors.push(`state.json: attempts[${branch}].requestRef must be ${requiredRequestRef}; attempt refs cannot escape their branch`);
    if (attempt.responseRef && attempt.responseRef !== requiredResponseRef) errors.push(`state.json: attempts[${branch}].responseRef must be ${requiredResponseRef}; attempt refs cannot escape their branch`);
    const requestFile = path.join(session, requiredRequestRef);
    if (!existsSync(requestFile)) errors.push(`state.json: attempts[${branch}] preserves no request.json`);
    else {
      try {
        const request = JSON.parse(await readFile(requestFile, 'utf8'));
        if (request.attempt?.id !== attempt.id) errors.push(`state.json: attempts[${branch}].id does not match its request`);
        if (expectedHash(request.expected) !== attempt.expectedHash) errors.push(`state.json: attempts[${branch}] does not preserve the expected written before execution`);
        if (JSON.stringify(request.frozenInputs ?? []) !== JSON.stringify(attempt.frozenInputs ?? [])) errors.push(`state.json: attempts[${branch}] does not preserve its request-side frozenInputs commitments`);
      } catch (error) { errors.push(`state.json: attempts[${branch}] request cannot be read: ${error.message}`); }
    }
    if (attempt.number > 1) {
      const previous = Object.values(state.attempts).find((candidate) => candidate.id === attempt.previous);
      if (!previous) errors.push(`state.json: attempts[${branch}].previous ${attempt.previous ?? 'missing'} is not preserved`);
      else if (previous.number + 1 !== attempt.number) errors.push(`state.json: attempts[${branch}].number does not follow ${previous.id}`);
    }
    if (attempt.status !== 'running' && attempt.status !== 'waiting' && !attempt.responseRef) errors.push(`state.json: terminal attempt ${attempt.id} preserves no responseRef`);
  }
  if (state.status === 'done' || phase === 'closed-success') {
    for (let index = 0; index < (mission.doneWhen ?? []).length; index += 1) {
      let backed = false;
      for (const [branch, attempt] of Object.entries(state.attempts ?? {})) {
        if (attempt.status !== 'matched') continue;
        try {
          const parts = branch.split('/');
          const base = path.join(session, `step-${parts[0]}`, `parallel-${parts[1]}`, ...(parts[2] ? [parts[2]] : []));
          const request = JSON.parse(await readFile(path.join(base, 'request', 'request.json'), 'utf8'));
          const response = JSON.parse(await readFile(path.join(base, 'response', 'response.json'), 'utf8'));
          const required = new Set((request.expected?.criteria ?? []).filter((criterion) => criterion.required).map((criterion) => criterion.id));
          const observations = response.actual?.observations ?? [];
          const observed = new Map(observations.map((observation) => [observation.criterionId, observation]));
          const compared = new Map((response.comparison?.criteria ?? []).map((criterion) => [criterion.criterionId, criterion]));
          const declared = new Set(Object.values(response.fields ?? {}).flatMap((value) => Array.isArray(value) ? value : [value]));
          const criterionProof = required.size > 0 && [...required].every((id) => {
            const observation = observed.get(id);
            const comparison = compared.get(id);
            return observation?.evidence?.length && comparison?.verdict === 'matched' && comparison.evidence?.length
              && observation.evidence.every((ref) => declared.has(ref) && existsSync(path.join(base, ref)))
              && comparison.evidence.every((ref) => observation.evidence.includes(ref));
          });
          if (request.goal?.doneWhen === index
            && response.contractVersion === V22_CONTRACT
            && response.status === 'done'
            && response.attempt?.id === attempt.id
            && response.attempt?.expectedVersion === attempt.expectedVersion
            && response.actual?.expectedVersion === attempt.expectedVersion
            && response.comparison?.expectedVersion === attempt.expectedVersion
            && response.comparison?.verdict === 'matched'
            && response.comparison?.next === 'advance'
            && criterionProof) { backed = true; break; }
        } catch {}
      }
      if (!backed) errors.push(`state.json: doneWhen:${index} is not backed by a matched v2.2 attempt with actual evidence; brief.proven prose cannot close a goal`);
    }
  }
  return errors;
}
export function loadStateSchema(root = ROOT) {
  if (!stateSchemas.has(root)) stateSchemas.set(root, JSON.parse(readFileSync(path.join(root, STATE_SCHEMA), 'utf8')));
  return stateSchemas.get(root);
}
// The spellings brief.proven admits, read from the schema that publishes them.
export const provenEntry = (root = ROOT) => new RegExp(loadStateSchema(root).$defs.provenEntry.pattern);
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
    out.push({ branch, operator: state.steps[branch], doneWhen: goal?.doneWhen ?? null, prerequisite: goal?.prerequisite ?? null, done, achieved: accepted && response.goalCheck.achieved === true });
  }
  return out;
}
// brief.proven on a mission session cites what a receipt evidenced and nothing else, in the two
// spellings the state schema publishes (#/$defs/provenEntry): "doneWhen:<n> " for a done-when line,
// and "prerequisite:<N/M> " for a branch whose goal was to enable another one — a bind, a preflight,
// an audit a later walk needed. Both resolve through the same ledger: the branch is done and its
// goalCheck was accepted by the response gate. A prerequisite branch evidences no done-when line by
// design, so without this spelling the memory of the orchestrator has nowhere to record it and a
// proven step of the mission lives only in the transition notes.
export function provenErrors(state, ledger, { root = ROOT } = {}) {
  const errors = [];
  if (!state?.mission) return errors;
  const lines = state.mission.doneWhen ?? [];
  const spelling = provenEntry(root);
  for (const entry of state.brief?.proven ?? []) {
    const m = spelling.exec(entry);
    if (!m) { errors.push(`state.json: brief.proven "${entry.slice(0, 60)}" cites neither a done-when line nor a prerequisite branch; on a mission every proven entry opens with "doneWhen:<n> " or "prerequisite:<N/M> " and only a validator-accepted goalCheck puts it there`); continue; }
    if (m.groups.prerequisite !== undefined) {
      const branch = m.groups.prerequisite;
      const record = ledger.find((b) => b.branch === branch);
      if (!record) { errors.push(`state.json: brief.proven cites prerequisite:${branch}, which state.json.steps does not record; a proven prerequisite is a branch of this chain`); continue; }
      if (record.prerequisite === null) { errors.push(`state.json: brief.proven cites prerequisite:${branch}, whose goal is done-when line ${record.doneWhen}; a branch that evidences a done-when line is proven as "doneWhen:${record.doneWhen} "`); continue; }
      if (!record.achieved) errors.push(`state.json: brief.proven cites prerequisite:${branch} (${record.operator}, enabling ${record.prerequisite}) and that branch carries no validator-accepted goalCheck with achieved true; what no receipt evidenced is not proven`);
      continue;
    }
    const n = Number(m.groups.doneWhen);
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
export async function plannedUnits(root, session, state) {
  const out = [];
  for (const branch of Object.keys(state?.steps ?? {}).sort(byChainOrder)) {
    const file = path.join(branchDir(session, branch), 'response', 'data', 'units.json');
    if (!existsSync(file)) continue;
    const response = await readJson(path.join(branchDir(session, branch), 'response', 'response.json'));
    if (response?.status !== 'done') continue;
    const { units } = await loadUnits(root, file, file);
    if (units) out.push({ branch, at: `step-${branch.replace('/', '/parallel-')}`, units });
  }
  return out;
}

export async function unitBudgetErrors(root, session, state) {
  const errors = [];
  if (state?.budget?.units === undefined) return errors;
  const plans = await plannedUnits(root, session, state);
  const latest = plans[plans.length - 1];
  if (!latest) return errors;
  const expected = budgetUnitsOf(latest.units);
  if (state.budget.units !== expected) errors.push(`state.json: budget.units is ${state.budget.units} and the plan of ${latest.at} carries ${expected} journey unit(s) of ${latest.units.units.length}; the step cap grows per unit a lane is dispatched over, and a deferred unit is unchecked rather than a branch`);
  return errors;
}

// The scope line of the goal block: how far this mission's verification reaches, over every plan the
// mission landed and not only the newest one. A mission that plans surfaces and then plans flows has
// two plans and one coverage, and the person read one line: taking the count off the latest plan alone
// lets a second plan whose units are all journey erase the first plan's deferrals from the line the
// person was shown, while the ledger under @worktrees/unchecked still carries them. The counts are the
// plans' own — journey is what a verifying lane is dispatched over (scripts/unchecked.mjs#VERIFY_LANES,
// budgetUnitsOf), deferred is every unit the plans tiered secondary — so the line is never a second
// count somebody wrote by hand.
export async function missionScopeErrors(root, session, state) {
  const scope = state?.mission?.scope;
  if (!scope) return [];
  const plans = await plannedUnits(root, session, state);
  if (!plans.length) return [`state.json: mission.scope says ${scope.journey} journey and ${scope.deferred} unchecked, and no plan of this session has landed a units.json; the scope line is filled from a plan's own counts and is absent before one`];
  let journey = 0, total = 0;
  for (const plan of plans) { journey += budgetUnitsOf(plan.units); total += plan.units.units.length; }
  const deferred = total - journey;
  if (scope.journey === journey && scope.deferred === deferred) return [];
  return [`state.json: mission.scope says ${scope.journey} journey and ${scope.deferred} unchecked, and the plans of this session (${plans.map((p) => p.at).join(', ')}) carry ${journey} and ${deferred}; the scope line the person read is every landed plan's own count, not the newest plan's alone`];
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
  // The queue is what the next mission is taken from, so it says where this one got to. The
  // orchestrator marks the entry `running:<sessionId>` when it opens the session and `done:<sessionId>`
  // when the session ends done (resources/orchestrator.json#helpers.bank), and nothing else moves it:
  // a session that ended blocked or stopped leaves the entry `running`, which is how a mission that
  // stopped for the person pauses the bank rather than letting the next one open behind its back
  // (scripts/bank.mjs#next). An entry left `running` under a done session, or marked `done` under a
  // session that stopped, is a queue that reads the opposite of what happened.
  else {
    const wanted = state.status === 'done' ? 'done' : 'running';
    const got = isDone(entry) ? 'done' : 'running';
    if (got !== wanted) errors.push(`state.json: ${at}/queue.json has ${missionId} at ${entry.status} and this session is ${state.status}; the entry is marked running when the session opens and done only when the session ends done, so a mission that stopped for the person stays running and pauses the bank`);
  }
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
  errors.push(...validateAgainst(loadStateSchema(root), state, 'state.json'));
  errors.push(...await v22SessionErrors(session, state));
  if (state.contractVersion === V22_CONTRACT && state.lifecycle?.phase === 'draft') return { errors, state };
  if (state.contractVersion === V22_CONTRACT && state.lifecycle?.phase === 'active' && state.status === 'running' && !(state.chain ?? []).length && !Object.keys(state.attempts ?? {}).length) return { errors, state };
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
  errors.push(...provenErrors(state, ledger, { root }));
  errors.push(...threeBranchStopErrors(state, ledger));
  errors.push(...loggedErrors(state));
  // Every done audit or walk with a failing verdict left its findings in the family's ledger.
  errors.push(...await findingsLedgerErrors(root, session, state, ledgerDir ? { ledgerDir } : {}));
  // Every done plan or verification that deferred coverage left its entries in the feature's ledger, and
  // the fan-out budget counts the journey the mission actually verifies.
  errors.push(...await uncheckedLedgerErrors(root, session, state, uncheckedRoot ? { hostRoot: uncheckedRoot } : {}));
  errors.push(...await unitBudgetErrors(root, session, state));
  errors.push(...await missionScopeErrors(root, session, state));
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
