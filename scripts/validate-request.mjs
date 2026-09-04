// The request half of one branch (step-N/parallel-M/request/request.json), checked before any agent
// runs: the gate schema; the operator exists and is an operator.md package; every requirement key is
// one the operator declares and every required one (Default —) has a value; every declared input is
// present when required, points inside the session, and the file exists; a nested exchange's request
// names an exchange the operator's Outputs declare. A request that fails here is the orchestrator's
// or the person's mistake, never the agent's.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from './json-schema.mjs';
import { loadOperatorPackages, kindOf, isYes, exchangeOf } from './operator-md.mjs';
import { loadInteractionPolicy, selectionErrors } from './validate-interaction.mjs';
import { validateImportedInput } from './producer-import.mjs';

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
export function effectiveBudget(state) {
  const budget = state?.budget;
  if (!budget) return null;
  const caps = { maxSteps: budget.maxSteps, maxSameOperator: budget.maxSameOperator };
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
export const EFFECT_TOOLS = ['sourcewrite', 'git', 'container', 'database', 'browsercontrol', 'host'];
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

export async function validateRequest(root, dir, packages) {
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
    for (const [kind, row] of declaredInputs) if (isYes(row.required) && isEmpty(request.inputs?.[kind])) errors.push(`request.json: required input ${kind} is absent`);
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
  if (!errors.length && request.operatorId === 'workspace.bind' && !request.exchange) {
    const { validateWorkspaceCheckoutRequest } = await import('./workspace-checkout.mjs');
    errors.push(...validateWorkspaceCheckoutRequest(root, request, dir));
  }
  if (!errors.length && request.operatorId === 'quality.verify' && !request.exchange) {
    const { validateCoveragePolicyRequest } = await import('./coverage-policy.mjs');
    errors.push(...validateCoveragePolicyRequest(root, dir, request));
  }
  if (!errors.length && request.operatorId === 'backend.source.apply') {
    const { validateMigrationContract } = await import('./migration-contract.mjs');
    errors.push(...(await validateMigrationContract(root, dir, request)).errors);
  }
  if (!errors.length && request.operatorId === 'release.deploy' && request.requirements?.migration != null) {
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
