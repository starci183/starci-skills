// The request half of one branch (step-N/parallel-M/request/request.json), checked before any agent
// runs: the gate schema; the operator exists and is an operator.md package; every requirement key is
// one the operator declares and every required one (Default —) has a value; every declared input is
// present when required, points inside the session, and the file exists; a nested exchange's request
// names an exchange the operator's Outputs declare; on a session that carries a mission the branch
// names its goal (a done-when line this operator produces, or the branch it enables); an isolated
// operator's request names nothing its Context table does not cover. A request that fails here is the
// orchestrator's or the person's mistake, never the agent's.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { validateAgainst } from './json-schema.mjs';
import { loadOperatorPackages, kindOf, isYes, exchangeOf, cellAliases } from './operator-md.mjs';
import { loadInteractionPolicy, selectionErrors } from './validate-interaction.mjs';
import { validateImportedInput } from './producer-import.mjs';
import { isJourney, journeyUnits, tierOf, verifiesUnits, laneOf } from './unchecked.mjs';
import { normalizeResource, resourcesOverlap } from './resource-locks.mjs';
import { currentRequestPhase } from './validation-phase.mjs';

// Only a fully quoted cell is unquoted: a sentence that opens with a code span keeps its backticks.
const unquote = (s) => { const t = String(s ?? '').trim(); return /^`[^`]*`$/.test(t) ? t.slice(1, -1) : t; };
export const isRequiredField = (row) => row.default.trim().startsWith('—');
export const isEmpty = (v) => v === undefined || v === null || v === '' || v === '—';

// A branch dir is <session>/step-N/parallel-M; an exchange dir is <branch>/<exchange>.
export function sessionRootOf(dir) {
  let cur = path.resolve(dir);
  for (let i = 0; i < 4; i += 1) { if (/^step-\d+$/.test(path.basename(cur))) return path.dirname(cur); cur = path.dirname(cur); }
  return null;
}

// The host repository that owns this tree: the stacks live beside the tree, never inside it.
export const hostRootOf = (root) => path.resolve(root, '..');

// An `env` requirement names one stack of the installation. The names are read from the folder, never
// listed here: a tree installed beside another set of stacks must accept that set, and a hard-coded
// vocabulary would be a second home for something the filesystem already publishes. A machine with no
// stacks at all checks nothing, because there is nothing to check against.
export function missingStack(root, env, hostRoot = hostRootOf(root)) {
  if (isEmpty(env)) return null;
  const stacks = path.join(hostRoot, '.stacks');
  if (!existsSync(stacks)) return null;
  return existsSync(path.join(stacks, String(env))) ? null : `.stacks/${env}`;
}

// What an environment declares about itself lives in its folder, in the shape the environment schema
// gives; the classes an operation can fall under, the defaults an omitted class takes and the shape of
// a reference to the declaration are all read from that schema, so a gate carries no copy of them.
const ENVIRONMENT_SCHEMA = path.join('readiness', 'initialization', 'stacks', 'environment.schema.json');
export async function loadEnvironmentSchema(root) {
  return JSON.parse(await readFile(path.join(root, ENVIRONMENT_SCHEMA), 'utf8'));
}
// An approval that names a declaration does so by path and content hash; anything else is an id.
export function parseDeclarationReference(schema, value) {
  if (typeof value !== 'string') return null;
  const m = new RegExp(schema.$defs.reference.pattern).exec(value);
  return m ? { env: m[1], hash: m[2] } : null;
}
export const declarationPath = (env) => `.stacks/${env}/environment.json`;
// Reads one environment's declaration as it stands on disk: its bytes hashed, its shape checked
// against the schema, and its authorization completed with the defaults its production flag selects.
export async function stackDeclaration(root, env, hostRoot = hostRootOf(root), schema = null) {
  schema ??= await loadEnvironmentSchema(root);
  const rel = declarationPath(env);
  const file = path.join(hostRoot, rel);
  const out = { rel, file, exists: existsSync(file), hash: null, reference: null, declaration: null, authorization: null, errors: [] };
  if (!out.exists) return out;
  const bytes = await readFile(file);
  out.hash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  out.reference = `${rel}#${out.hash}`;
  try { out.declaration = JSON.parse(bytes.toString('utf8')); } catch (e) { out.errors.push(`${rel}: ${e.message}`); return out; }
  out.errors.push(...validateAgainst(schema, out.declaration, rel));
  if (out.declaration?.env !== undefined && out.declaration.env !== env) out.errors.push(`${rel}: declares env ${out.declaration.env} inside the ${env} folder`);
  if (out.errors.length) return out;
  const defaults = schema.$defs.defaults[out.declaration.production ? 'production' : 'non-production'];
  out.authorization = { ...defaults, ...(out.declaration.authorization ?? {}) };
  return out;
}

// The caps a session runs under, after every extension a recorded user choice of continue granted.
const PER_UNIT = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'orchestrator.json'), 'utf8')).budget?.perUnit ?? 0;
export function effectiveBudget(state, perUnit = PER_UNIT) {
  const budget = state?.budget;
  if (!budget) return null;
  // A plan that produced N units earns N × perUnit more steps: the cap is per unit, not per mission.
  const caps = { maxSteps: budget.maxSteps + perUnit * (budget.units ?? 0), maxSameOperator: budget.maxSameOperator + (budget.units ?? 0) };
  for (const ext of budget.extensions ?? []) {
    const choice = state.choices?.[ext.decisionId];
    if (!choice || choice.selected !== 'continue') continue;
    caps.maxSteps = Math.max(caps.maxSteps, ext.maxSteps);
    caps.maxSameOperator = Math.max(caps.maxSameOperator, ext.maxSameOperator);
  }
  return caps;
}
// A live session (one with a transition) carries brief and budget; a request that would pass a cap is
// BUDGET_EXHAUSTED for the orchestrator to write, and the gate names the cap it would pass.
export function sessionBudgetErrors(state, request) {
  const errors = [];
  const live = (state?.transitions ?? []).length > 0;
  if (live && !state.brief) errors.push("state.json: a session with a transition carries brief, the orchestrator's memory of the mission");
  if (live && !state.budget) errors.push('state.json: a session with a transition carries budget, the caps it runs under');
  const caps = effectiveBudget(state);
  if (!caps || request.exchange) return errors;
  if (request.step > caps.maxSteps) errors.push(`state.json: step ${request.step} passes budget.maxSteps ${caps.maxSteps} (BUDGET_EXHAUSTED); a recorded user choice of continue on a budget:<id> decision extends it`);
  const same = Object.entries(state.steps ?? {}).filter(([branch, op]) => op === request.operatorId && Number(branch.split('/')[0]) !== request.step).length;
  if (same + 1 > caps.maxSameOperator) errors.push(`state.json: ${request.operatorId} would run for the ${same + 1}th time, past budget.maxSameOperator ${caps.maxSameOperator} (BUDGET_EXHAUSTED); the same operator re-entered this often is the loop NO_PROGRESS exists to end`);
  return errors;
}

// The tools whose declaration in operator.json → resources.tools means the operator writes routed source
// or touches a runtime. Whether a mission needs its goal confirmed is decided from the tools the
// operators in its chain declare, never from a list of operator ids: an operator that gains
// @tools/sourcewrite tomorrow needs the confirmation tomorrow without this file changing. A tool held
// in mode never or read only inspects (git read, container read, database read) and counts for nothing.
export const EFFECT_TOOLS = ['sourcewrite', 'git', 'container', 'database', 'browsercontrol', 'host', 'registry'];
const READ_ONLY_MODES = ['never', 'read'];
export const goalDecisionId = (sessionId, version) => `goal:${sessionId}:v${version}`;
export function operatorEffects(pkg) {
  return Object.entries(pkg?.manifest?.resources?.tools ?? {})
    .map(([id, mode]) => ({ id: id.replace(/^@tools\//, ''), mode }))
    .filter(({ id, mode }) => EFFECT_TOOLS.includes(id) && !READ_ONLY_MODES.includes(mode));
}
// The mission writes routed source or touches a runtime when any operator the chain names does.
export function missionTouchesRuntime(operatorIds, packages) {
  return operatorIds.map((id) => packages.find((p) => p.manifest?.id === id)).some((pkg) => operatorEffects(pkg).length > 0);
}
// The mission's goal is confirmed by the person before anything runs. For a mission that writes routed
// source or touches a runtime, state.json carries mission (the goal, its inclusions and exclusions, and
// what counts as done, each done-when line naming the operator whose receipt is that evidence), and its
// latest version is confirmed by a goal-confirm choice the person selected as-stated. A corrected
// version was asked again as the next version, so an unconfirmed or corrected latest version runs
// nothing. Like brief and budget, the gate applies only to a live session (one with a transition) or
// one that already carries a mission: the self-test fixtures write a bare state.json with neither, and
// they stay green; the session gate catches a chain that dispatched without a mission at its first
// transition. `request` may be null when the check runs over the whole session.
export function missionGateErrors(state, request, packages, policy = { selectionSource: 'user' }) {
  const errors = [];
  if (!state) return errors;
  const live = (state.transitions ?? []).length > 0 || state.mission !== undefined;
  if (!live) return errors;
  const operatorIds = [...new Set([...Object.values(state.steps ?? {}), ...(request?.operatorId ? [request.operatorId] : [])])];
  if (!missionTouchesRuntime(operatorIds, packages)) return errors;
  const refuse = (what) => errors.push(`state.json: the mission's goal is not confirmed: ${what}`);
  const mission = state.mission;
  if (!mission) { refuse('no mission block; the chain writes routed source or touches a runtime, so the goal, its inclusions and exclusions and what counts as done are printed to the person and confirmed before anything runs'); return errors; }
  for (const line of mission.doneWhen ?? []) if (!packages.some((p) => p.manifest?.id === line.producedBy)) refuse(`doneWhen "${line.evidence}" names ${line.producedBy}, which is not an operator`);
  const sessionId = state.id ?? request?.sessionId;
  const decisionId = goalDecisionId(sessionId, mission.version);
  const choice = state.choices?.[decisionId];
  if (!choice) { refuse(`no choices["${decisionId}"]; the person answers the goal-confirm question and the answer is recorded before the first dispatch`); return errors; }
  if (choice.selected === 'corrected') refuse(`version ${mission.version} was corrected; the corrected goal is written as version ${mission.version + 1} and asked again`);
  else if (choice.selected !== 'as-stated') refuse(`choices["${decisionId}"].selected is ${choice.selected}, not as-stated`);
  if (choice.selectedBy !== policy.selectionSource) refuse(`choices["${decisionId}"] is selected by ${choice.selectedBy}, never by an agent`);
  if (typeof choice.sourceRef !== 'string' || !choice.sourceRef.trim()) refuse(`choices["${decisionId}"] carries no sourceRef to the person's message`);
  return errors;
}

// The branch goal. On a session that carries a mission, every branch says what it is for: the one
// done-when line its receipt evidences (goal.doneWhen, an index into state.json.mission.doneWhen whose
// producedBy is this operator) or the branch it is a prerequisite of (goal.prerequisite, a branch
// state.json.steps records). A branch that points at nothing does not run. A nested exchange belongs
// to its branch and carries no goal of its own. Guarded by state.mission exactly as missionGateErrors
// is, so a fixture with a bare state.json stays green.
export function branchGoalErrors(state, request) {
  const errors = [];
  if (!state?.mission || !request) return errors;
  if (request.exchange) { if (request.goal !== undefined) errors.push('request.json: a nested exchange carries no goal; the branch it belongs to does'); return errors; }
  const lines = state.mission.doneWhen ?? [];
  const goal = request.goal;
  if (!goal) { errors.push(`request.json: the session carries a mission, so the branch names its goal: goal.doneWhen, the index (0–${lines.length - 1}) of the mission line ${request.operatorId} produces the evidence for, or goal.prerequisite, the branch N/M it enables; a branch that points at nothing does not run`); return errors; }
  if (goal.doneWhen !== undefined) {
    const line = lines[goal.doneWhen];
    if (!line) errors.push(`request.json: goal.doneWhen ${goal.doneWhen} is not a line of state.json.mission.doneWhen (${lines.length} lines, indexes 0–${lines.length - 1})`);
    else if (line.producedBy !== request.operatorId) errors.push(`request.json: goal.doneWhen ${goal.doneWhen} ("${line.evidence}") is produced by ${line.producedBy}, not by ${request.operatorId}; a branch serves only a line its own receipt evidences`);
  }
  if (goal.prerequisite !== undefined) {
    const mine = `${request.step}/${request.parallel}`;
    if (goal.prerequisite === mine) errors.push(`request.json: goal.prerequisite names this branch itself (${mine}); a prerequisite enables another branch`);
    else if (state.steps?.[goal.prerequisite] === undefined) errors.push(`request.json: goal.prerequisite names ${goal.prerequisite}, which state.json.steps does not record; a prerequisite enables a branch of the chain`);
  }
  return errors;
}

// The requirements the plan fixed for a branch (state.json.planned["N/M"].requirements, written from
// scripts/plan-chain.mjs presets when the chain is drawn: a bind's role, a preflight's roles, a preset
// mode) are what the chain was validated on before the branch's request existed; the request that
// dispatches the branch carries them unchanged, or it runs a branch the chain was never checked for.
// Read here before dispatch and by scripts/validate-chain.mjs over the ledger.
export function plannedRequirementErrors(planned, request, at = 'request.json') {
  const errors = [];
  for (const [key, value] of Object.entries(planned?.requirements ?? {})) {
    const actual = request?.requirements?.[key];
    if (!isDeepStrictEqual(actual, value)) errors.push(`${at}: requirements.${key} ${actual === undefined ? 'is absent' : `is ${JSON.stringify(actual)}`} and the plan fixed it as ${JSON.stringify(value)} (state.json.planned); the chain was validated on the planned value, so the dispatched request carries it`);
  }
  for (const [kind, ref] of Object.entries(planned?.inputs ?? {})) {
    const actual = request?.inputs?.[kind];
    if (actual !== ref) errors.push(`${at}: inputs.${kind} ${actual === undefined ? 'is absent' : `is ${JSON.stringify(actual)}`} and the plan bound it to the imported slot ${ref} (state.json.planned)`);
  }
  return errors;
}

export const V22_CONTRACT = 'starci/v2.2';
const FAMILY_BOUND_OPERATORS = new Set(['interface.plan', 'interface.generate', 'interface.fix', 'interface.audit', 'knowledge.repair']);
const SOURCE_WRITING_OPERATORS = new Set(['backend.generate', 'interface.generate', 'interface.fix', 'knowledge.repair', 'library.update']);
const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};

export async function frozenInputErrors(dir, request) {
  const errors = [];
  for (const item of request?.frozenInputs ?? []) {
    const file = path.resolve(dir, item.ref);
    const requestRoot = `${path.resolve(dir, 'request')}${path.sep}`;
    if (!file.startsWith(requestRoot)) { errors.push(`request.json: frozenInputs ref ${item.ref} escapes request/`); continue; }
    if (!existsSync(file)) { errors.push(`request.json: frozenInputs ref ${item.ref} is missing before dispatch`); continue; }
    const actual = `sha256:${createHash('sha256').update(await readFile(file)).digest('hex')}`;
    if (actual !== item.sha256) errors.push(`request.json: frozenInputs ${item.ref} has ${actual}, expected ${item.sha256}; request-side evidence changed after it was frozen`);
  }
  return errors;
}

const UI_BINDINGS = {
  'interface.plan': ['@knowledge/ui/composition'],
  'interface.generate': ['@knowledge/ui/composition', '@knowledge/ui/presentation', '@knowledge/ui/proof'],
  'interface.fix': ['@knowledge/ui/presentation'],
  'interface.audit': ['@knowledge/ui/composition', '@knowledge/ui/presentation', '@knowledge/ui/proof']
};
const ALL_UI_BINDINGS = ['@knowledge/ui/composition', '@knowledge/ui/presentation', '@knowledge/ui/proof'];

export function uiKnowledgeBindingsFor(request) {
  const aliases = (request?.contexts ?? []).map((context) => context.alias);
  const familyAliases = aliases.filter((alias) => /^@knowledge\/grammars\/[a-z0-9][a-z0-9-]*$/.test(alias));
  const ui = request?.operatorId === 'knowledge.repair' ? ALL_UI_BINDINGS : (UI_BINDINGS[request?.operatorId] ?? []);
  return [...new Set([...ui, ...familyAliases])];
}

export async function uiKnowledgeRequestErrors(root, dir, request, { phase = currentRequestPhase() } = {}) {
  if (request?.contractVersion !== V22_CONTRACT) return [];
  const aliases = (request.contexts ?? []).map((context) => context.alias);
  const familyAliases = aliases.filter((alias) => /^@knowledge\/grammars\/[a-z0-9][a-z0-9-]*$/.test(alias));
  const affected = FAMILY_BOUND_OPERATORS.has(request.operatorId) || (request.operatorId === 'library.update' && familyAliases.length > 0);
  if (!affected) return [];
  const manifestModule = path.join(root, 'scripts', 'knowledge-manifest.mjs');
  const familyModule = path.join(root, 'scripts', 'ui-knowledge-gate.mjs');
  if (!existsSync(manifestModule) || !existsSync(familyModule)) return ['request.json: the v2.2 UI knowledge semantic gates are unavailable; hashes alone cannot freeze an incomplete manifest'];
  const [{ knowledgeManifestErrors, frozenKnowledgeManifestErrors }, { frozenFamilyUnderstandingErrors, routedFamily }] = await Promise.all([import(pathToFileURL(manifestModule).href), import(pathToFileURL(familyModule).href)]);
  const family = routedFamily(request);
  if (!family) return ['request.json: no unique concrete @knowledge/grammars/<family> binding; a family is never inferred or defaulted'];
  const bindings = uiKnowledgeBindingsFor(request);
  if (phase === 'accept' && typeof frozenKnowledgeManifestErrors !== 'function') return ['request/knowledge-manifest.json: the phase-safe frozen manifest validator is unavailable; acceptance cannot compare a pre-mutation manifest to mutated live sources'];
  const manifestErrors = phase === 'accept'
    ? await frozenKnowledgeManifestErrors({ root, branchDir: dir, bindings, family })
    : await knowledgeManifestErrors({ root, branchDir: dir, bindings, family });
  return [
    ...manifestErrors,
    ...await frozenFamilyUnderstandingErrors(dir, { root, family })
  ];
}

export function expectedNotWeakenedErrors(previous, current, at = 'request.json') {
  const errors = [];
  if (!previous || !current) return errors;
  if (current.goalVersion < previous.goalVersion) errors.push(`${at}: expected.goalVersion moved backwards from ${previous.goalVersion} to ${current.goalVersion}`);
  if (current.version < previous.version) errors.push(`${at}: expected.version moved backwards from ${previous.version} to ${current.version}`);
  if (current.goalVersion !== previous.goalVersion) return errors;
  const before = new Map((previous.criteria ?? []).map((criterion) => [criterion.id, criterion]));
  const after = new Map((current.criteria ?? []).map((criterion) => [criterion.id, criterion]));
  for (const [id, criterion] of before) {
    if (!criterion.required) continue;
    const next = after.get(id);
    if (!next) errors.push(`${at}: expected criterion ${id} was required by the previous attempt and is missing; retry history may keep or strengthen expected, never erase it`);
    else if (!next.required) errors.push(`${at}: expected criterion ${id} changed from required to optional; actual cannot weaken expected`);
    else if (next.expected !== criterion.expected || next.verification !== criterion.verification) errors.push(`${at}: required expected criterion ${id} changed under goal version ${current.goalVersion}; preserve it or confirm a new goal version`);
  }
  if (current.version === previous.version && canonicalJson(previous) !== canonicalJson(current)) errors.push(`${at}: expected version ${current.version} changed content; changing expected creates a new version and preserves the old one`);
  return errors;
}

export function v22RequestErrors(state, request, pkg, dir = null) {
  const errors = [];
  const stateV22 = state?.contractVersion === V22_CONTRACT;
  const requestV22 = request?.contractVersion === V22_CONTRACT;
  if (stateV22 && !requestV22) errors.push(`request.json: contractVersion ${V22_CONTRACT} is required by this v2.2 session; legacy compatibility is not an execution bypass`);
  if (requestV22 && !stateV22) errors.push(`request.json: a v2.2 attempt cannot run under a legacy or unmarked state.json`);
  if (!stateV22 || !requestV22) return errors;
  if (request.sessionId !== state.id) errors.push(`request.json: sessionId ${request.sessionId} does not match the owning session ${state.id}`);
  if (state.lifecycle?.phase !== 'active') errors.push(`state.json: lifecycle.phase is ${state.lifecycle?.phase ?? 'missing'}; only an active, confirmed user session dispatches attempts`);
  if (state.mission?.confirmation?.status !== 'confirmed') errors.push(`state.json: mission version ${state.mission?.version ?? 'missing'} is not explicitly confirmed`);
  if (request.expected?.goalVersion !== state.mission?.version) errors.push(`request.json: expected.goalVersion ${request.expected?.goalVersion ?? 'missing'} does not match mission.version ${state.mission?.version ?? 'missing'}`);
  const expectedSource = request.goal?.doneWhen !== undefined
    ? `state.json#mission:v${state.mission?.version}/doneWhen:${request.goal.doneWhen}`
    : request.goal?.prerequisite ? `state.json#mission:v${state.mission?.version}/prerequisite:${request.goal.prerequisite}` : null;
  if (expectedSource && request.expected?.sourceRef !== expectedSource) errors.push(`request.json: expected.sourceRef is ${request.expected?.sourceRef ?? 'missing'}; this branch resolves to ${expectedSource}`);
  if (request.environment?.mode !== pkg?.manifest?.resources?.mode) errors.push(`request.json: environment.mode ${request.environment?.mode ?? 'missing'} does not match ${request.operatorId}'s ${pkg?.manifest?.resources?.mode ?? 'missing'} mode`);
  if (dir && request.environment?.outputRoot) {
    const output = path.resolve(dir, request.environment.outputRoot);
    const owned = path.resolve(dir, 'response');
    if (output !== owned) errors.push(`request.json: environment.outputRoot resolves to ${output}; an attempt owns only ${owned}`);
  }
  if (request.environment?.workspace?.worktree && !path.isAbsolute(request.environment.workspace.worktree)) errors.push(`request.json: environment.workspace.worktree is not absolute; isolation names the exact worktree`);
  const writes = request.environment?.writes ?? [];
  const exclusive = request.environment?.exclusive ?? [];
  const workspace = request.environment?.workspace?.worktree ?? null;
  if (writes.length && SOURCE_WRITING_OPERATORS.has(request.operatorId) && !workspace) errors.push(`request.json: ${request.operatorId} writes source but environment.workspace.worktree is absent; the actual isolated checkout is always leased`);
  if (writes.length && !workspace && !exclusive.length) errors.push('request.json: environment.writes is nonempty while no concrete environment.exclusive owner or workspace worktree is leased');
  const owners = [...exclusive, ...(workspace ? [workspace] : [])].filter((value) => path.isAbsolute(value)).map(normalizeResource);
  for (const write of writes.filter((value) => path.isAbsolute(value)).map(normalizeResource)) {
    if (!owners.some((owner) => resourcesOverlap(owner, write))) errors.push(`request.json: environment.writes path ${write} is not covered by a concrete exclusive owner or workspace worktree`);
  }
  const criteria = request.expected?.criteria ?? [];
  const criterionIds = criteria.map((criterion) => criterion.id);
  if (new Set(criterionIds).size !== criterionIds.length) errors.push(`request.json: expected.criteria ids are not unique`);
  const contextAliases = new Set((request.contexts ?? []).map((context) => context.alias));
  const reads = new Set(request.environment?.reads ?? []);
  for (const alias of contextAliases) if (!reads.has(alias)) errors.push(`request.json: environment.reads does not name context ${alias}; the environment binding lists every readable input`);
  const families = [...contextAliases].filter((alias) => /^@knowledge\/grammars\/[a-z0-9][a-z0-9-]*$/.test(alias));
  if (FAMILY_BOUND_OPERATORS.has(request.operatorId) || (request.operatorId === 'library.update' && families.length > 0)) {
    if (families.length !== 1) errors.push(`request.json: ${request.operatorId} binds exactly one concrete @knowledge/grammars/<family> context; no root or fallback family is accepted`);
    const frozen = new Set((request.frozenInputs ?? []).map((item) => item.ref));
    for (const ref of ['request/knowledge-manifest.json', 'request/family-understanding.json']) if (!frozen.has(ref)) errors.push(`request.json: ${request.operatorId} freezes ${ref} before attempt-gate open`);
  }
  const mine = `${request.step}/${request.parallel}${request.exchange ? `/${request.exchange}` : ''}`;
  const attempts = Object.entries(state.attempts ?? {});
  for (const [branch, attempt] of attempts) if (branch !== mine && attempt.id === request.attempt?.id) errors.push(`request.json: attempt.id ${attempt.id} already belongs to ${branch}`);
  const previousId = request.attempt?.previous;
  const previousEntry = attempts.find(([, attempt]) => attempt.id === previousId);
  if (request.attempt?.number === 1) {
    if (previousId !== null) errors.push(`request.json: attempt number 1 has no previous attempt`);
    if (request.attempt?.kind !== 'initial') errors.push(`request.json: attempt number 1 has kind initial`);
  } else {
    if (!previousId) errors.push(`request.json: attempt number ${request.attempt?.number} names the previous attempt`);
    else if (!previousEntry) errors.push(`request.json: attempt.previous ${previousId} is not preserved in state.json.attempts`);
    else {
      const [, previous] = previousEntry;
      if (previous.operatorId !== request.operatorId) errors.push(`request.json: attempt.previous ${previousId} ran ${previous.operatorId}, not ${request.operatorId}`);
      if (request.attempt.number !== previous.number + 1) errors.push(`request.json: attempt.number ${request.attempt.number} does not follow ${previous.number}`);
      errors.push(...expectedNotWeakenedErrors(previous.expected, request.expected));
    }
  }
  return errors;
}

export async function attemptProgressErrors(sessionRoot, state, request) {
  if (request?.contractVersion !== V22_CONTRACT || request.attempt?.number === 1) return [];
  const previous = Object.values(state.attempts ?? {}).find((attempt) => attempt.id === request.attempt.previous);
  if (!previous || !['mismatched', 'inconclusive'].includes(previous.status) || !previous.requestRef) return [];
  try {
    const before = JSON.parse(await readFile(path.join(sessionRoot, previous.requestRef), 'utf8'));
    const fingerprint = (value) => canonicalJson({ expected: value.expected, requirements: value.requirements, inputs: value.inputs, contexts: value.contexts, workspace: value.environment?.workspace, reads: value.environment?.reads, writes: value.environment?.writes, exclusive: value.environment?.exclusive, frozenInputs: value.frozenInputs });
    if (fingerprint(before) === fingerprint(request)) return [`request.json: retry ${request.attempt.id} repeats the same expected, inputs, frozen evidence, environment revision and resource ownership after ${previous.id} was ${previous.status} (NO_PROGRESS); repair the cause, change the verified method, or stay blocked`];
  } catch (error) { return [`state.json: previous attempt ${previous.id} cannot be read for progress comparison: ${error.message}`]; }
  return [];
}

// Whether a Context table row covers a request alias: the row's alias, with each <placeholder> standing
// for one path segment, is the alias itself or a prefix of it at a segment boundary.
export function contextCovers(rowAlias, alias) {
  const pattern = String(rowAlias).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/<[^>]+>/g, '[A-Za-z0-9_.@#:-]+');
  return new RegExp(`^${pattern}(?:/|$)`).test(alias);
}
// An isolated agent (operator.json → resources.mode) starts with an empty context and sees only
// brief.md, request.json and what request.json names. A context alias the operator's Context table
// does not cover is therefore a location it cannot read, and the request that names it is refused.
export function isolatedContextErrors(pkg, request) {
  const errors = [];
  if (pkg?.manifest?.resources?.mode !== 'isolated' || !pkg.en) return errors;
  const rows = (pkg.en.tables.context?.rows ?? []).map((r) => cellAliases(r.alias)[0]).filter(Boolean);
  (request.contexts ?? []).forEach((c, i) => {
    if (!rows.some((row) => contextCovers(row, c.alias))) errors.push(`request.json: contexts[${i}].alias ${c.alias} is covered by no Context row of ${pkg.manifest.id}; an isolated agent reads only the aliases its Context table declares (${rows.join(', ') || 'none'})`);
  });
  return errors;
}

// The unit of a blind agent is one page, one modal, one flow. A plan operator, <domain>.plan, writes the
// data kind `units` (templates/kinds/units.schema.json): the closed list of what the execute operators
// of its domain do one branch at a time. The schema states the shape; the two relations a schema cannot
// state are read here — ids are unique, dependsOn names ids of the same file, and a unit's tier agrees
// with its deferral — so the plan's own validator, the fan-out gate and the spec share one reading of
// the file. The tier relation is the coverage ruling made refusable: a secondary unit is one the
// mission's journey does not pass through, so it is not verified and is written down as unchecked, and
// coverage left unchecked with no reason is a skip nobody can read; a journey unit is verified, so it
// defers nothing.
export const UNITS_SCHEMA = path.join('templates', 'kinds', 'units.schema.json');
export function unitsErrors(doc, at = 'units.json') {
  const errors = [];
  const ids = new Set();
  for (const u of doc?.units ?? []) {
    if (ids.has(u.id)) errors.push(`${at}: unit ${u.id} is declared twice; a unit id is the address an execute branch names, and an address resolves to one unit`);
    ids.add(u.id);
  }
  for (const u of doc?.units ?? []) for (const d of u.dependsOn ?? []) {
    if (d === u.id) errors.push(`${at}: unit ${u.id} depends on itself`);
    else if (!ids.has(d)) errors.push(`${at}: unit ${u.id} depends on ${d}, which this file does not declare; dependsOn names units of the same plan`);
  }
  for (const u of doc?.units ?? []) {
    if (isJourney(u)) {
      if (u.deferral !== undefined) errors.push(`${at}: unit ${u.id} is tier journey and carries a deferral; the mission's journey passes through it, so it is verified and nothing about it is owed`);
    } else if (!u.deferral?.reason) {
      errors.push(`${at}: unit ${u.id} is tier secondary and carries no deferral.reason; a unit the journey does not reach is not verified, and coverage nobody gave a reason for is a skip rather than a recorded gap`);
    }
  }
  if (doc?.units?.length && !journeyUnits(doc).length) errors.push(`${at}: every unit is tier secondary, so the mission's done-when journey passes through none of them and nothing would be verified; a plan whose journey is empty is a plan of the wrong mission`);
  return errors;
}
// Reads one units.json against its schema and the relations above; `units` is null when it cannot be read.
export async function loadUnits(root, file, at = 'units.json') {
  if (!existsSync(file)) return { units: null, errors: [`${at}: missing`] };
  let doc; try { doc = JSON.parse(await readFile(file, 'utf8')); } catch (e) { return { units: null, errors: [`${at}: ${e.message}`] }; }
  const schema = JSON.parse(await readFile(path.join(root, UNITS_SCHEMA), 'utf8'));
  const errors = validateAgainst(schema, doc, at);
  if (!errors.length) errors.push(...unitsErrors(doc, at));
  return { units: errors.length ? null : doc, errors };
}
// The line between a fix and a regeneration, in kind and in patience (resources/orchestrator.json#fixSize;
// the count half is the operator's own validator). Kind: the rule a finding cites is published under one
// topic folder of knowledge/ui, and a finding of a folder the orchestrator lists under generateTopics, or
// whose prefix it lists under generatePrefixes, is a decision about composition or taste — a surface
// generated again, not patched. Patience: a finding that survived escalateAfter fix branches of this
// session is not fixed a further time; it is the same regeneration. Both refusals name FIX_TOO_LARGE,
// the code the operator's Stops table already hands to the interface domain.
export const FIX_OPERATOR = 'interface.fix';
const RULE_ID = /^([A-Z][A-Z0-9]*)-\d+$/;
const stepOfCell = (cell) => Number(String(cell).split('/')[0]);
const parallelOfCell = (cell) => Number(String(cell).split('/')[1]);
// prefix → topic folder, read from the ## headings knowledge/ui publishes; a prefix belongs to the first folder that publishes it.
export async function rulePrefixTopics(root) {
  const out = new Map();
  const base = path.join(root, 'knowledge', 'ui');
  if (!existsSync(base)) return out;
  for (const topic of await readdir(base)) {
    const dir = path.join(base, topic);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of await readdir(dir)) {
      if (!f.endsWith('.md') || f.endsWith('.vi.md')) continue;
      for (const m of (await readFile(path.join(dir, f), 'utf8')).matchAll(/^## ([A-Z][A-Z0-9]*)-\d+/gm)) if (!out.has(m[1])) out.set(m[1], topic);
    }
  }
  return out;
}
export async function loadFixSize(root) {
  const file = path.join(root, 'resources', 'orchestrator.json');
  if (!existsSync(file)) return null;
  try { return JSON.parse(await readFile(file, 'utf8')).fixSize ?? null; } catch { return null; }
}
export async function fixKindErrors(root, state, request, sessionRoot, { size = undefined, topics = undefined } = {}) {
  const errors = [];
  if (request?.operatorId !== FIX_OPERATOR || request.exchange) return errors;
  size = size === undefined ? await loadFixSize(root) : size;
  if (!size) return errors;
  const finding = request.requirements?.finding;
  if (typeof finding !== 'string' || !finding) return errors;
  const rule = finding.split('/').pop();
  const m = RULE_ID.exec(rule);
  if (m) {
    const prefix = m[1];
    topics = topics === undefined ? await rulePrefixTopics(root) : topics;
    const topic = topics.get(prefix) ?? null;
    if ((size.generatePrefixes ?? []).includes(prefix)) errors.push(`request.json: finding ${finding} cites ${rule}, and ${prefix} is a lens the orchestrator lists under fixSize.generatePrefixes; a taste or direction finding is a surface generated again, not a fix (FIX_TOO_LARGE)`);
    else if (topic && (size.generateTopics ?? []).includes(topic)) errors.push(`request.json: finding ${finding} cites ${rule}, a ${topic} rule, and the orchestrator lists ${topic} under fixSize.generateTopics; a ${topic} finding is a surface generated again, not a fix (FIX_TOO_LARGE)`);
  }
  const after = Number.isInteger(size.escalateAfter) ? size.escalateAfter : null;
  if (after !== null && state?.steps && sessionRoot) {
    const cells = [];
    for (const [cell, id] of Object.entries(state.steps)) {
      if (id !== FIX_OPERATOR || !(stepOfCell(cell) < request.step)) continue;
      const f = path.join(sessionRoot, `step-${stepOfCell(cell)}`, `parallel-${parallelOfCell(cell)}`, 'request', 'request.json');
      if (!existsSync(f)) continue;
      try { if (JSON.parse(await readFile(f, 'utf8')).requirements?.finding === finding) cells.push(cell); } catch { /* an unreadable earlier request is its own branch's error */ }
    }
    if (cells.length >= after) errors.push(`request.json: finding ${finding} was already fixed ${cells.length} time(s) in this session (${cells.join(', ')}) and fixSize.escalateAfter is ${after}; a finding that survives a fix is a surface generated again, not fixed once more (FIX_TOO_LARGE)`);
  }
  return errors;
}

// An operator plans when its Outputs table declares the kind `units`; the plan operator of a domain is
// `<domain>.plan`, the domain being the first segment of an operator id (`uat.verify` → `uat`).
export const domainOfId = (operatorId) => String(operatorId ?? '').split('.')[0];
export const producesUnits = (pkg) => (pkg?.en?.tables?.outputs?.rows ?? []).some((r) => kindOf(r.kind) === 'units');
// The plan is the execute operator's only when that operator binds the plan's list: an Inputs row of
// kind `units`. An operator of the same domain that binds no units (a fix answers one finding) is run
// twice as two branches, never fanned out through a plan it does not read.
export const bindsUnits = (pkg) => (pkg?.en?.tables?.inputs?.rows ?? []).some((r) => kindOf(r.kind) === 'units');
export function planOperatorOf(operatorId, packages) {
  const id = `${domainOfId(operatorId)}.plan`;
  const pkg = (packages ?? []).find((p) => p.manifest?.id === id);
  const execute = (packages ?? []).find((p) => p.manifest?.id === operatorId);
  return pkg && producesUnits(pkg) && (execute ? bindsUnits(execute) : false) ? pkg : null;
}
// The fan-out gate. A branch that runs one unit names it in request.json.unit and binds the plan's file
// as inputs.units, a units.json an earlier branch produced; the id must be one that file carries, and
// the branch sits within orchestrator.json#concurrency.maxParallel. On a mission that names more than
// one done-when line for an execute operator whose domain has a plan operator, a branch without a unit
// is refused: it would take every unit at once, and a blind agent takes one. Guarded by state.mission
// exactly as the other mission gates are, so a fixture with a bare state.json stays green.
export async function unitGateErrors(root, state, request, packages, sessionRoot) {
  const errors = [];
  if (!state?.mission || !request || request.exchange) return errors;
  const plan = planOperatorOf(request.operatorId, packages);
  if (request.unit === undefined) {
    if (!plan || /\.plan$/.test(String(request.operatorId))) return errors;
    const lines = (state.mission.doneWhen ?? []).filter((l) => l.producedBy === request.operatorId).length;
    if (lines > 1) errors.push(`request.json: ${request.operatorId} runs one unit per branch: the mission names ${lines} done-when lines for it and ${plan.manifest.id} exists, so the branch carries unit, an id of the units.json ${plan.manifest.id} produced, bound as inputs.units; a branch without a unit would take every unit at once, and a blind agent takes one`);
    return errors;
  }
  const orchestrator = JSON.parse(await readFile(path.join(root, 'resources', 'orchestrator.json'), 'utf8'));
  const cap = orchestrator.concurrency?.maxParallel;
  if (Number.isInteger(cap) && request.parallel > cap) errors.push(`request.json: parallel ${request.parallel} passes concurrency.maxParallel ${cap} (resources/orchestrator.json); a step fans out to at most ${cap} unit branches, and the rest wait for the next step`);
  const file = request.inputs?.units;
  const m = /^step-(\d+)\/parallel-(\d+)\/response\/data\/units\.json$/.exec(String(file ?? ''));
  if (!m) { errors.push(`request.json: unit ${request.unit} names no plan: inputs.units binds a units.json an earlier branch produced (step-N/parallel-M/response/data/units.json), and the unit is one of its ids`); return errors; }
  if (Number(m[1]) >= request.step) errors.push(`request.json: inputs.units ${file} is not produced earlier than step ${request.step}; a unit comes from a plan that already ran`);
  if (!sessionRoot) return errors;
  const { units, errors: unitErrors } = await loadUnits(root, path.join(sessionRoot, file), file);
  errors.push(...unitErrors);
  if (!units) return errors;
  const producer = (packages ?? []).find((p) => p.manifest?.id === units.producedBy);
  if (!producer || !producesUnits(producer)) errors.push(`${file}: producedBy ${units.producedBy} is not an operator whose Outputs declare units; a unit list comes from a plan operator`);
  const named = units.units.find((u) => u.id === request.unit);
  if (!named) errors.push(`request.json: unit ${request.unit} is not an id of ${file} (${units.units.map((u) => u.id).join(', ')}); an execute branch runs one unit the plan named`);
  // Verification follows the journey. A verifying operator (scripts/unchecked.mjs#VERIFY_LANES) is
  // dispatched only over the units the mission's done-when journey passes through; a secondary unit is
  // an entry on the unchecked ledger, not a branch, and a run that fans out over it is the "render
  // every screen to be safe" the tiering exists to stop. Generation is not narrowed this way: interface.generate builds
  // what the plan lists, because generation scope is the person's goal rather than a proof.
  else if (verifiesUnits(request.operatorId) && !isJourney(named)) {
    errors.push(`request.json: ${request.operatorId} proves the ${laneOf(request.operatorId)} lane and unit ${request.unit} is tier ${tierOf(named)} in ${file}; verification covers the units the mission's journey passes through, and a secondary unit is carried as unchecked in that lane under @worktrees/unchecked rather than dispatched (${(units.units.filter(isJourney).map((u) => u.id).join(', ')) || 'no journey unit'} may be verified)`);
  }
  return errors;
}
// How many branches a plan's fan-out is paid for: the units a verifying lane will actually run. The
// step cap grows by orchestrator.json#budget.perUnit for each of these and by nothing for a unit that
// was deferred, so a mission that narrows its coverage narrows its budget in the same movement.
export const budgetUnitsOf = (doc) => journeyUnits(doc).length;

export async function validateRequest(root, dir, packages, { phase = currentRequestPhase() } = {}) {
  const errors = [];
  if(existsSync(path.join(dir,'import.json')))return {errors:['request.json: an imported producer slot is evidence-only and cannot execute an operator'],request:null};
  const rel = (f) => path.relative(sessionRootOf(dir) ?? dir, path.join(dir, f)).split(path.sep).join('/');
  const file = path.join(dir, 'request', 'request.json');
  if (!existsSync(file)) return { errors: [`${rel('request/request.json')}: missing`], request: null };
  let request; try { request = JSON.parse(await readFile(file, 'utf8')); } catch (e) { return { errors: [`${rel('request/request.json')}: ${e.message}`], request: null }; }
  const schema = JSON.parse(await readFile(path.join(root, 'templates', 'step', 'request.schema.json'), 'utf8'));
  errors.push(...validateAgainst(schema, request, rel('request/request.json')));
  packages ??= await loadOperatorPackages(root);
  const pkg = packages.find((p) => p.manifest.id === request.operatorId);
  if (!pkg) { errors.push(`request.json: unknown operator ${request.operatorId}`); return { errors, request }; }
  if (pkg.shape !== 'v9') { errors.push(`${request.operatorId} is not an operator.md package`); return { errors, request }; }
  const op = pkg.en;
  const sessionRoot = sessionRootOf(dir);
  let recordedChoices = {};
  const policy = await loadInteractionPolicy(root);

  if (request.exchange) {
    // A nested exchange: it must be one the operator's Outputs declare, and it carries no person-facing requirements.
    const declared = (op.tables.outputs?.rows ?? []).map((r) => exchangeOf(unquote(r.file))).filter(Boolean);
    if (!declared.includes(request.exchange)) errors.push(`request.json: exchange ${request.exchange} is not declared by an Output of ${op.id}`);
    if (Object.keys(request.requirements ?? {}).length) errors.push('request.json: a nested exchange carries no requirements');
  } else {
    const declared = new Map((op.tables.requirements?.rows ?? []).map((r) => [unquote(r.field), r]));
    for (const key of Object.keys(request.requirements ?? {})) if (!declared.has(key)) errors.push(`request.json: requirements.${key} is not a field ${op.id} declares`);
    for (const [key, row] of declared) if (isRequiredField(row) && isEmpty(request.requirements?.[key])) errors.push(`request.json: required field ${key} has no value`);
    const declaredInputs = new Map((op.tables.inputs?.rows ?? []).map((r) => [kindOf(r.kind), r]));
    for (const kind of Object.keys(request.inputs ?? {})) if (!declaredInputs.has(kind)) errors.push(`request.json: inputs.${kind} is not an Input ${op.id} declares`);
    // An isolated agent cannot go and find a missing input: what request.json does not name does not exist for it.
    const isolated = pkg.manifest.resources?.mode === 'isolated' ? `; ${op.id} runs isolated and sees only what request.json names, so the input is not there to be found` : '';
    for (const [kind, row] of declaredInputs) if (isYes(row.required) && isEmpty(request.inputs?.[kind])) errors.push(`request.json: required input ${kind} is absent${isolated}`);
    errors.push(...isolatedContextErrors(pkg, request));
  }
  for (const [kind, p] of Object.entries(request.inputs ?? {})) {
    if (!sessionRoot) { errors.push(`request.json: inputs.${kind} cannot be resolved; the branch is not under a session`); continue; }
    if (!existsSync(path.join(sessionRoot, p))) errors.push(`request.json: inputs.${kind} = ${p} does not exist in the session`);
    errors.push(...await validateImportedInput(root,sessionRoot,p,kind,{receivingSessionId:request.sessionId}));
  }
  // The orchestrator hashes every request into state.json; a request that changed since is tampering.
  if (sessionRoot && existsSync(path.join(sessionRoot, 'state.json'))) {
    try {
      const state = JSON.parse(await readFile(path.join(sessionRoot, 'state.json'), 'utf8'));
      recordedChoices = state.choices ?? {};
      errors.push(...validateAgainst(JSON.parse(await readFile(path.join(root, 'templates', 'step', 'state.schema.json'), 'utf8')), state, 'state.json'));
      errors.push(...v22RequestErrors(state, request, pkg, dir));
      errors.push(...await attemptProgressErrors(sessionRoot, state, request));
      // A resume re-enters the same operator and names a branch state.json knows; a re-entry state.json does not record is unrecorded evidence.
      if (request.resume) {
        const target = `${request.resume.step}/${request.resume.parallel}`;
        if (state.steps?.[target] === undefined) errors.push(`request.json: resume names ${target}, which state.json does not record`);
        else if (state.steps[target] !== request.operatorId) errors.push(`request.json: resume names ${target}, a ${state.steps[target]} branch, but this request runs ${request.operatorId}`);
        const mine = `${request.step}/${request.parallel}`;
        if (state.resumes && !state.resumes[mine]) errors.push(`request.json: state.json records no resumes[${mine}] for this re-entry`);
        else if (state.resumes?.[mine] && state.resumes[mine].resumes !== target) errors.push(`request.json: state.json resumes[${mine}] names ${state.resumes[mine].resumes}, the request names ${target}`);
      }
      // From the first transition on, the session carries the orchestrator's brief and its budget, and a
      // request past a cap is refused unless a recorded user choice of continue extended it.
      errors.push(...sessionBudgetErrors(state, request));
      // A mission that writes routed source or touches a runtime runs nothing until the person confirmed its goal.
      errors.push(...missionGateErrors(state, request, packages, policy));
      // On a mission, every branch points at the done-when line it serves or the branch it enables.
      errors.push(...branchGoalErrors(state, request));
      // A unit branch names one unit of a plan an earlier branch produced; a mission with several units for one execute operator fans out one unit per branch.
      errors.push(...await unitGateErrors(root, state, request, packages, sessionRoot));
      // The requirements the plan fixed for this branch are what the chain was validated on: the dispatched request carries them unchanged.
      if (!request.exchange) errors.push(...plannedRequirementErrors(state.planned?.[`${request.step}/${request.parallel}`], request));
      // A fix answers a finding of a fixable kind, and answers it once: a composition or taste finding, or one that survived a fix, is a surface generated again.
      errors.push(...await fixKindErrors(root, state, request, sessionRoot));
      const key = `${request.step}/${request.parallel}${request.exchange ? `/${request.exchange}` : ''}`;
      const expected = state.requestHashes?.[key];
      if (expected) {
        const { createHash } = await import('node:crypto');
        const actual = `sha256:${createHash('sha256').update(await readFile(file)).digest('hex')}`;
        if (actual !== expected) errors.push(`request.json: hash ${actual} differs from state.json requestHashes[${key}]`);
      }
    } catch (e) { errors.push(`state.json: ${e.message}`); }
  }
  errors.push(...selectionErrors(policy, request, recordedChoices));
  if (request.contractVersion === V22_CONTRACT) errors.push(...await frozenInputErrors(dir, request));
  errors.push(...await uiKnowledgeRequestErrors(root, dir, request, { phase }));
  if (!errors.length && request.operatorId === 'workspace.bind' && !request.exchange) {
    const { validateWorkspaceCheckoutRequest } = await import('./workspace-checkout.mjs');
    errors.push(...validateWorkspaceCheckoutRequest(root, request, dir));
  }
  if (!errors.length && request.operatorId === 'quality.verify' && !request.exchange) {
    const { validateCoveragePolicyRequest } = await import('./coverage-policy.mjs');
    errors.push(...validateCoveragePolicyRequest(root, dir, request));
  }
  if (!errors.length && request.operatorId === 'backend.generate') {
    const { validateMigrationContract } = await import('./migration-contract.mjs');
    errors.push(...(await validateMigrationContract(root, dir, request)).errors);
  }
  if (!errors.length && request.operatorId === 'migration.release' && request.requirements?.migration != null) {
    const { validateMigrationReleaseRequest } = await import('./migration-release.mjs');
    errors.push(...(await validateMigrationReleaseRequest(root, dir, request)).errors);
  }
  return { errors, request, pkg };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node scripts/validate-request.mjs <session>/step-N/parallel-M[/<exchange>]\n'); process.exit(2); }
  validateRequest(root, path.resolve(target)).then(({ errors }) => {
    if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('request valid\n');
  }, (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
