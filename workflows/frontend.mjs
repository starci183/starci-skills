import { validateJourneys } from '../contracts/journeys.mjs';
import { validateAssets } from '../contracts/assets.mjs';
import { selectProfile } from '../profiles/select.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const home = fs.existsSync(path.join(moduleDirectory, 'frontend.json')) ? moduleDirectory : path.resolve(moduleDirectory, './');
export const workflow = JSON.parse(fs.readFileSync(path.join(home, 'frontend.json'), 'utf8'));
export const matrix = JSON.parse(fs.readFileSync(path.join(home, workflow.matrix), 'utf8'));
export const transitions = JSON.parse(fs.readFileSync(path.join(home, workflow.transitions), 'utf8'));
export const contracts = JSON.parse(fs.readFileSync(path.join(home, workflow.contracts), 'utf8'));
export const definition = { ...workflow, matrix: matrix.rows };
const stages = ['draw', 'implement', 'uat'];
const ops = ['interface.draw', 'interface.implement', 'uat.verify'];
const verdicts = ['pass', 'fail', 'not-run', 'inconclusive'];
const fail = message => { throw new Error(message); };
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
function shape(x, required, optional = []) {
  if (!object(x) || required.some(k => !Object.hasOwn(x, k)) || Object.keys(x).some(k => ![...required, ...optional].includes(k))) fail(`Invalid fields; expected ${required.join(', ')}`);
}
function string(x) { if (typeof x !== 'string' || !x.trim()) fail('Expected nonempty string'); }
function array(x, min = 0) { if (!Array.isArray(x) || x.length < min) fail('Invalid array'); }
function strings(x, min = 0) { array(x, min); x.forEach(string); }
function unique(x) { if (new Set(x).size !== x.length) fail('Duplicate identity'); }
function member(x, values) { if (!values.includes(x)) fail(`Invalid value: ${x}`); }
function same(a, b) { if (canonical(a) !== canonical(b)) fail('Handoff/request binding mismatch'); }
export function canonical(x) {
  if (Array.isArray(x)) return '[' + x.map(canonical).join(',') + ']';
  if (object(x)) return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
  return JSON.stringify(x);
}
export const digest = x => crypto.createHash('sha256').update(canonical(x)).digest('hex');
const sha = x => { if (!/^[a-f0-9]{64}$/.test(x)) fail('Expected SHA-256'); };

/** Matrix rows are sequential steps; cells within a row are parallel capacity. */
export function validateMatrix(matrix) {
  array(matrix, 1);
  if (matrix.length > 3) fail('At most 3 steps');
  const ids = [];
  for (const row of matrix) {
    array(row, 1); if (row.length > 3) fail('At most 3 parallel cells');
    for (const cell of row) { shape(cell, ['id', 'op']); string(cell.id); string(cell.op); ids.push(cell.id); }
  }
  unique(ids);
  if (ids.length > 9) fail('At most 9 primary operations per workflow');
  return true;
}
validateMatrix(definition.matrix);
same(definition.matrix, stages.map((id, i) => [{ id, op: ops[i] }]));

function flows(xs, implemented) { return validateJourneys(xs, { implemented }); }
function context(x) {
  shape(x, ['business', 'architecture', 'knowledge', 'repository', 'environment', 'accounts', 'fixtures', 'authorization'], ['execution']);
  for (const k of ['business', 'architecture', 'knowledge', 'authorization']) strings(x[k], 1);
  for (const k of ['accounts', 'fixtures']) strings(x[k]);
  string(x.repository); string(x.environment);
  if(x.execution!==undefined) {
    shape(x.execution,['runtime'],['profile','model','imageGenerationAvailable']);
    selectProfile({...x.execution,op:'interface.implement'});
  }
}
export function validateInput(x) {
  shape(x, contracts.input.requiredFields, contracts.input.optionalFields);
  same(x.schema, 'starci/frontend-input@1');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(x.runId)) fail('Invalid run ID');
  context(x.context); flows(x.journeys, false);
  if (x.criteria !== undefined) {
    shape(x.criteria, [], stages);
    for (const [stage, ids] of Object.entries(x.criteria)) { strings(ids); unique([...definition.criteria[stage], ...ids]); }
  }
  return true;
}
function criteriaFor(input, stage) { return [...definition.criteria[stage], ...(input.criteria?.[stage] ?? [])]; }
function codeRefs(xs) {
  array(xs, 1); unique(xs.map(x => x.repository + ':' + x.commit));
  for (const x of xs) { shape(x, ['repository', 'commit']); string(x.repository); if (!/^[a-f0-9]{40}$/.test(x.commit)) fail('Expected full code commit'); }
}
function runtime(x) {
  shape(x, ['environment', 'origin', 'build']); string(x.environment); string(x.build);
  const url = new URL(x.origin); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail('Invalid runtime origin');
}
function artifactShape(x) {
  shape(x, contracts.artifact.requiredFields); string(x.id); string(x.path); sha(x.sha256); member(x.kind, contracts.artifact.kinds);
}
function draws(xs) {
  array(xs, 1); unique(xs.map(x => x.id));
  for (const x of xs) {
    shape(x, ['id', 'artifact', 'screen', 'state', 'viewport']);
    ['id', 'artifact', 'screen', 'state'].forEach(k => string(x[k]));
    shape(x.viewport, ['width', 'height']);
    for (const n of Object.values(x.viewport)) if (!Number.isInteger(n) || n < 1) fail('Invalid viewport');
  }
}
function expectedInputs(input, index, previous) {
  if (index === 0) return { context: input.context, journeys: input.journeys };
  if (index === 1) return { context: input.context, journeys: input.journeys, draws: previous.outputs.draws, drawArtifacts: previous.artifacts };
  return { context: input.context, flows: previous.outputs.flows, codeRefs: previous.outputs.codeRefs, runtime: previous.outputs.runtime, assets: previous.outputs.assets };
}
export function makeRequest(input, index, previous = null) {
  validateInput(input); if (!Number.isInteger(index) || index < 0 || index > 2) fail('Invalid step');
  if (index > 0 && !previous) fail('Previous accepted response required');
  return { schema: 'starci/request@1', workflow: 'frontend', runId: input.runId, step: index + 1, slot: 1, op: ops[index],
    requestId: `${input.runId}:${stages[index]}`, upstreamDigest: previous ? digest(previous) : null,
    inputs: expectedInputs(input, index, previous), criteria: criteriaFor(input, stages[index]) };
}
function validateRequest(req) {
  shape(req, contracts.request.requiredFields);
  same(req.schema, 'starci/request@1'); same(req.workflow, 'frontend');
  member(req.step, [1, 2, 3]); same(req.slot, 1); same(req.op, ops[req.step - 1]);
  string(req.runId); same(req.requestId, `${req.runId}:${stages[req.step - 1]}`);
  req.step === 1 ? same(req.upstreamDigest, null) : sha(req.upstreamDigest);
  strings(req.criteria, 1); unique(req.criteria);
  if (!definition.criteria[stages[req.step - 1]].every(id => req.criteria.includes(id))) fail('Required criteria missing');
  if (req.step === 1) { shape(req.inputs, ['context', 'journeys']); context(req.inputs.context); flows(req.inputs.journeys, false); }
  if (req.step === 2) {
    shape(req.inputs, ['context', 'journeys', 'draws', 'drawArtifacts']); context(req.inputs.context); flows(req.inputs.journeys, false); draws(req.inputs.draws);
    array(req.inputs.drawArtifacts, 1); req.inputs.drawArtifacts.forEach(artifactShape);
  }
  if (req.step === 3) { shape(req.inputs, ['context', 'flows', 'codeRefs', 'runtime','assets']); context(req.inputs.context); flows(req.inputs.flows, true); codeRefs(req.inputs.codeRefs); runtime(req.inputs.runtime); validateAssets(req.inputs.assets,assetOptions(req.inputs.context.execution)); }
}
function inside(root, target) { const r = path.relative(root, target); return r === '' || (!r.startsWith('..' + path.sep) && r !== '..' && !path.isAbsolute(r)); }
function artifactFile(root, relative) {
  if (path.posix.isAbsolute(relative) || path.win32.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(s => !s || s === '.' || s === '..' || s.includes(':'))) fail('Unsafe artifact path');
  const base = fs.realpathSync(root), candidate = path.resolve(base, relative);
  if (!inside(base, candidate)) fail('Artifact path escapes run');
  let cursor = base;
  for (const segment of relative.split('/')) { cursor = path.join(cursor, segment); if (fs.lstatSync(cursor).isSymbolicLink()) fail('Artifact symlink rejected'); }
  if (!inside(base, fs.realpathSync(candidate))) fail('Artifact real path escapes run');
  if (!fs.statSync(candidate).isFile() || fs.statSync(candidate).size === 0) fail('Missing/empty artifact');
  return candidate;
}
function verifyArtifacts(root, artifacts) {
  array(artifacts, 1); unique(artifacts.map(x => x.id)); unique(artifacts.map(x => x.path));
  for (const a of artifacts) {
    artifactShape(a);
    const file = artifactFile(root, a.path);
    if (crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== a.sha256) fail('Artifact digest mismatch');
  }
}
function refs(ids, artifacts, kind) {
  strings(ids, 1); unique(ids);
  for (const id of ids) if (!artifacts.some(a => a.id === id)) fail('Unknown evidence reference');
  if (kind && !ids.some(id => artifacts.some(a => a.id === id && a.kind === kind))) fail(`Missing ${kind} evidence`);
}
function assetOptions(execution) {
  if(!execution)return {allowDeferred:false,imageGeneration:false};
  const selected=selectProfile({...execution,op:'interface.implement'});
  return {allowDeferred:selected.allowDeferredArtwork,imageGeneration:selected.imageGeneration};
}
export function validateFEHandoff(out, acceptedJourneys, repository, environment, {execution,drawIds}={}) {
  flows(acceptedJourneys, false);
  shape(out, ['flows', 'codeRefs', 'runtime','assets']); flows(out.flows, true); codeRefs(out.codeRefs); runtime(out.runtime);
  validateAssets(out.assets,{...assetOptions(execution),drawIds});
  same(out.flows.map(({ sourcePaths, ...intent }) => intent), acceptedJourneys);
  if (!out.codeRefs.some(x => x.repository === repository)) fail('Missing selected repository code reference');
  same(out.runtime.environment, environment);
  return true;
}
function validateOutputs(req, res) {
  const out = res.outputs, assets = res.artifacts;
  if (req.step === 1) {
    shape(out, ['draws']); draws(out.draws);
    out.draws.forEach(x => refs([x.artifact], assets, 'image'));
  } else if (req.step === 2) {
    validateFEHandoff(out, req.inputs.journeys, req.inputs.context.repository, req.inputs.context.environment,{execution:req.inputs.context.execution,drawIds:req.inputs.draws.map(d=>d.id)});
    for(const asset of out.assets.items)if(asset.status!=='deferred')refs([asset.artifact],assets,'image');
    if (!assets.some(a => a.kind === 'image')) fail('Missing implemented render');
  } else {
    shape(out, ['results', 'cleanup']); array(out.results, 1);
    same(out.results.map(x => x.flowId), req.inputs.flows.map(x => x.id));
    for (let i = 0; i < out.results.length; i++) {
      const result = out.results[i], f = req.inputs.flows[i];
      shape(result, ['flowId', 'status', 'steps', 'evidence']); member(result.status, verdicts);
      refs(result.evidence, assets, 'image'); refs(result.evidence, assets, 'video');
      array(result.steps, 1); same(result.steps.map(s => s.id), f.steps.map(s => s.id));
      for (let j = 0; j < result.steps.length; j++) {
        const observed = result.steps[j], wanted = f.steps[j];
        shape(observed, ['id', 'status', 'observation', 'checks', 'evidence']); member(observed.status, verdicts); string(observed.observation); refs(observed.evidence, assets);
        array(observed.checks); same(observed.checks.map(x => x.id), wanted.uxChecks.map(x => x.id));
        for (let k = 0; k < observed.checks.length; k++) {
          const check = observed.checks[k]; shape(check, ['id', 'answer', 'status', 'evidence']);
          member(check.status, verdicts); member(check.answer, ['yes', 'no', null]);
          refs(check.evidence, assets);
          if (check.status === 'pass' && check.answer !== wanted.uxChecks[k].expected) fail('UX answer contradicts expected');
          if (res.status === 'pass' && check.status !== 'pass') fail('UX check not passed');
        }
        if (res.status === 'pass' && observed.status !== 'pass') fail('Flow step not passed');
      }
      if (res.status === 'pass' && result.status !== 'pass') fail('Flow not passed');
    }
    shape(out.cleanup, ['status', 'remaining', 'evidence']); member(out.cleanup.status, verdicts); strings(out.cleanup.remaining); refs(out.cleanup.evidence, assets);
    if (res.status === 'pass' && (out.cleanup.status !== 'pass' || out.cleanup.remaining.length)) fail('Cleanup incomplete');
  }
}
/** Checks shape/binding and bytes, not whether a worker's observation is semantically true. */
export function validateResponse(req, res, root) {
  validateRequest(req);
  shape(res, contracts.response.requiredFields);
  same(res.schema, 'starci/response@1');
  for (const k of ['workflow', 'runId', 'step', 'slot', 'op', 'requestId']) same(res[k], req[k]);
  same(res.requestDigest, digest(req)); member(res.status, ['pass', 'fail', 'blocked']);
  array(res.criteria, 1); unique(res.criteria.map(x => x.id));
  same(res.criteria.map(x => x.id).sort(), [...req.criteria].sort());
  array(res.artifacts); res.artifacts.forEach(artifactShape);
  if (res.artifacts.length) verifyArtifacts(root, res.artifacts);
  for (const c of res.criteria) {
    shape(c, ['id', 'status', 'observation', 'evidence']); member(c.status, verdicts); string(c.observation);
    if (c.status === 'pass') refs(c.evidence, res.artifacts); else { strings(c.evidence); if (c.evidence.length) refs(c.evidence, res.artifacts); }
  }
  if (res.status !== 'pass') { same(res.outputs, null); return { pass: false, reason: res.status }; }
  if (res.criteria.some(x => x.status !== 'pass')) fail('All criteria must pass');
  validateOutputs(req, res);
  return { pass: true };
}
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeNew = (file, x) => fs.writeFileSync(file, JSON.stringify(x, null, 2) + '\n', { flag: 'wx' });
const reqPath = (root, i) => path.join(root, `${i + 1}-${stages[i]}.request.json`);
const resPath = (root, i) => path.join(root, `${i + 1}-${stages[i]}.response.json`);
function runRoot(root) {
  const resolved = path.resolve(root);
  if (fs.lstatSync(resolved).isSymbolicLink() || !fs.statSync(resolved).isDirectory()) fail('Run must be a real directory');
  return fs.realpathSync(resolved);
}
function lock(root, action) {
  const file = path.join(root, '.gate.lock'); const fd = fs.openSync(file, 'wx');
  try { return action(); } finally { fs.closeSync(fd); fs.unlinkSync(file); }
}
export function initialize(input, directory) {
  validateInput(input);
  const root = path.resolve(directory);
  if (inside(path.resolve(home, '..'), root)) fail('Store run evidence outside the installed runtime');
  fs.mkdirSync(root); // Existing runs are never replaced.
  writeNew(path.join(root, 'input.json'), input);
  const req = makeRequest(input, 0); writeNew(reqPath(root, 0), req);
  return { done: false, request: reqPath(root, 0), requestDigest: digest(req) };
}
function replay(root) {
  const input = readJSON(path.join(root, 'input.json')); validateInput(input);
  let previous = null;
  for (let i = 0; i < 3; i++) {
    const expected = makeRequest(input, i, previous);
    if (fs.existsSync(reqPath(root, i))) same(readJSON(reqPath(root, i)), expected);
    const accepted = resPath(root, i);
    if (!fs.existsSync(accepted)) {
      for (let later = i + 1; later < 3; later++) if (fs.existsSync(resPath(root, later))) fail('Skipped workflow step');
      return { input, index: i, request: expected };
    }
    const response = readJSON(accepted);
    if (!validateResponse(expected, response, root).pass) fail('Stored response has not passed');
    previous = response;
  }
  return { input, index: 3 };
}
export function inspect(directory) {
  const root = runRoot(directory), state = replay(root);
  if (fs.existsSync(path.join(root, 'support-pending.json'))) return { done: false, waiting: true, support: path.join(root, 'support-pending.json') };
  return state.index === 3 ? { done: true } : { done: false, request: reqPath(root, state.index), requestDigest: digest(state.request) };
}
export function advance(directory, response) {
  const root = runRoot(directory);
  return lock(root, () => {
    if (fs.existsSync(path.join(root, 'support-pending.json'))) fail('Parent waits for backend support');
    const state = replay(root);
    if (state.index === 3) fail('Workflow already complete');
    if (!fs.existsSync(reqPath(root, state.index))) writeNew(reqPath(root, state.index), state.request);
    const result = validateResponse(state.request, response, root);
    if (!result.pass) return { done: false, advanced: false, reason: result.reason, request: reqPath(root, state.index) };
    if (state.index === 1 && fs.existsSync(path.join(root, 'support-history'))) {
      const history = path.join(root, 'support-history');
      const accepted = fs.readdirSync(history).filter(n => n.endsWith('.response.json')).sort((a, b) => Number(a.split('.')[0]) - Number(b.split('.')[0])).map(n => readJSON(path.join(history, n))).filter(r => r.status === 'pass');
      const contributions = accepted.flatMap(item => item.outputs.codeRefs);
      for (const {repository, commit} of contributions) if (!response.outputs.codeRefs.some(ref => ref.repository === repository && ref.commit === commit)) fail('FE handoff must include accepted backend support commits');
    }
    writeNew(resPath(root, state.index), response);
    if (state.index === 2) return { done: true, advanced: true };
    const next = makeRequest(state.input, state.index + 1, response), file = reqPath(root, state.index + 1);
    if (fs.existsSync(file)) same(readJSON(file), next); else writeNew(file, next);
    return { done: false, advanced: true, request: file, requestDigest: digest(next) };
  });
}
/** Reopens an existing matrix cell; accepted downstream work is archived, never discarded. */
export function repair(directory, diagnosis) {
  shape(diagnosis, ['reason', 'observation', 'method']);
  string(diagnosis.observation); string(diagnosis.method);
  const route = transitions.repair.routes[diagnosis.reason];
  if (!route) fail('Unknown repair reason');
  const root = runRoot(directory);
  return lock(root, () => {
    if (fs.existsSync(path.join(root, 'support-pending.json'))) fail('Resolve pending support before reopening parent');
    const state = replay(root);
    if (state.index === 3) fail('Completed run needs a newly selected workflow; do not silently reopen it');
    if (route === 'user') return { transition: 'blocked', reason: diagnosis.reason, observation: diagnosis.observation };
    let index = route === 'same' ? state.index : stages.indexOf(route);
    if (index < 0 || index > state.index) fail('Repair cannot skip forward');
    const attempts = path.join(root, 'attempts');
    fs.mkdirSync(attempts, { recursive: true });
    const records = fs.readdirSync(attempts).filter(n => /^attempt-\d+$/.test(n)).map(n => readJSON(path.join(attempts, n, 'repair.json')));
    const matching = records.filter(r => r.step === index + 1);
    const fingerprint = digest({ step: index + 1, ...diagnosis });
    if (matching.at(-1)?.fingerprint === fingerprint) return { transition: 'blocked', reason: 'no-progress', request: reqPath(root, index) };
    if (matching.length >= transitions.repair.maxAutomaticAttemptsPerStep) return { transition: 'blocked', reason: 'automatic-attempt-limit', request: reqPath(root, index) };
    const folder = path.join(attempts, `attempt-${records.length + 1}`); fs.mkdirSync(folder);
    writeNew(path.join(folder, 'repair.json'), { step: index + 1, ...diagnosis, fingerprint, requestDigest: digest(readJSON(reqPath(root, index))) });
    // All paths are fixed direct children of the verified run root, not operator-supplied paths.
    for (let i = index; i < 3; i++) {
      const files = [resPath(root, i), ...(i > index ? [reqPath(root, i)] : [])];
      for (const file of files) if (fs.existsSync(file)) {
        if (!inside(root, file) || fs.lstatSync(file).isSymbolicLink()) fail('Unsafe repair target');
        fs.renameSync(file, path.join(folder, path.basename(file)));
      }
    }
    const request = readJSON(reqPath(root, index));
    const instruction = { schema: 'starci/repair@1', op: request.op, request: reqPath(root, index), requestDigest: digest(request),
      diagnosis, instruction: 'AI repairs within existing authority, preserving this request and every criterion, then submits a fresh response to advance.', history: folder };
    writeNew(path.join(folder, 'instruction.json'), instruction);
    return { transition: 'repair', step: index + 1, op: request.op, request: reqPath(root, index), instruction: path.join(folder, 'instruction.json') };
  });
}
function authority(op, name = 'authority.json') {
  const directory = fs.existsSync(path.resolve(home, '../ops')) ? path.resolve(home, '../ops') : path.resolve(home, '../ops');
  return readJSON(path.join(directory, op, name));
}
function secondaryPolicy(parentOp, childOp) {
  const parent = authority(parentOp);
  const call = parent.primary.calls.find(c => c.op === childOp);
  if (!call || call.authority !== 'secondary.json') fail('Secondary authority denied');
  const config = authority(parentOp, call.authority);
  same(config.schema, 'starci/op-secondary@1'); same(config.owner, parentOp);
  same(config.maxDefinitions, 3); array(config.calls);
  if (config.calls.length > config.maxDefinitions) fail('At most 3 secondary operator definitions per primary');
  unique(config.calls.map(c => c.op));
  if (config.maxJobs > 3 || config.maxJobs < 1) fail('Invalid secondary job limit');
  const policy = config.calls.find(c => c.op === childOp && c.role === call.role);
  if (!policy || policy.canCallOthers !== false || policy.canAdvanceWorkflow !== false || policy.canCompleteParent !== false) fail('Secondary authority denied');
  return { ...policy, maxJobs: config.maxJobs };
}
export function support(directory, input) {
  const root = runRoot(directory);
  return lock(root, () => {
    const state = replay(root);
    if (state.index !== 1) fail('Backend support belongs only to the current FE implementation cell');
    const parent = authority(state.request.op), policy = secondaryPolicy(state.request.op, 'backend.implement');
    shape(input, ['repository', 'paths', 'changeKind', 'problem', 'businessRefs']);
    string(input.repository); strings(input.paths, 1); unique(input.paths); string(input.problem);
    for (const p of input.paths) if (path.win32.isAbsolute(p) || path.posix.isAbsolute(p) || p.includes('\\') || p.split('/').some(x => !x || x === '..' || x === '.')) fail('Support source paths must be scoped relative paths');
    member(input.changeKind, policy.allowedChangeKinds);
    same(input.businessRefs, state.request.inputs.context.business);
    const pendingFile = path.join(root, 'support-pending.json');
    const pending = fs.existsSync(pendingFile) ? readJSON(pendingFile) : { requests: [] };
    const jobs = path.join(root, 'support-jobs'); fs.mkdirSync(jobs, { recursive: true });
    const total = fs.readdirSync(jobs).filter(n => n.endsWith('.request.json')).length;
    if (total >= Math.min(3, parent.primary.maxSecondary, policy.maxJobs)) fail('At most 3 secondary jobs per primary operation');
    for (const relative of pending.requests) {
      const other = readJSON(path.join(root, relative));
      if (other.inputs.repository === input.repository && other.inputs.paths.some(p => input.paths.some(q => p.toLowerCase() === q.toLowerCase()))) fail('Secondary write scopes overlap; wait for the existing secondary');
    }
    const supportId = 'support-' + (total + 1);
    const request = { schema: 'starci/support-request@1', supportId, role: transitions.support.role, op: policy.op,
      parentRequestId: state.request.requestId, parentRequestDigest: digest(state.request), inputs: input, criteria: policy.requiredCriteria };
    const relative = 'support-jobs/' + supportId + '.request.json'; writeNew(path.join(root, relative), request);
    pending.requests.push(relative); fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2) + '\n');
    return { done: false, waiting: true, step: 2, slot: 1, op: request.op, supportId, request: path.join(root, relative), requestDigest: digest(request) };
  });
}
export function resume(directory, response) {
  const root = runRoot(directory);
  return lock(root, () => {
    const pendingFile = path.join(root, 'support-pending.json'), pending = readJSON(pendingFile), state = replay(root);
    if (state.index !== 1) fail('Support parent is no longer current');
    shape(response, ['schema', 'supportId', 'requestDigest', 'status', 'criteria', 'outputs', 'artifacts']);
    const relative = pending.requests.find(p => readJSON(path.join(root, p)).supportId === response.supportId);
    if (!relative) fail('No matching pending secondary');
    const req = readJSON(path.join(root, relative)); same(req.parentRequestDigest, digest(state.request));
    const policy = secondaryPolicy(state.request.op, req.op); same(req.criteria, policy.requiredCriteria);
    same(response.schema, 'starci/support-response@1'); same(response.requestDigest, digest(req));
    member(response.status, ['pass', 'fail', 'blocked']);
    array(response.criteria, 1); unique(response.criteria.map(x => x.id)); same(response.criteria.map(x => x.id).sort(), [...req.criteria].sort());
    array(response.artifacts); if (response.artifacts.length) verifyArtifacts(root, response.artifacts);
    for (const c of response.criteria) {
      shape(c, ['id', 'status', 'observation', 'evidence']); member(c.status, verdicts); string(c.observation);
      if (c.status === 'pass') refs(c.evidence, response.artifacts); else strings(c.evidence);
    }
    const archive = path.join(root, 'support-history'); fs.mkdirSync(archive, { recursive: true });
    const number = fs.readdirSync(archive).filter(x => x.endsWith('.response.json')).length + 1;
    if (response.status !== 'pass') {
      same(response.outputs, null); writeNew(path.join(archive, number + '.response.json'), response);
      return { done: false, waiting: true, request: path.join(root, relative) };
    }
    if (response.criteria.some(c => c.status !== 'pass')) fail('Support criteria must pass');
    shape(response.outputs, ['codeRefs', 'changedPaths', 'businessChanged', 'apiCompatible']);
    codeRefs(response.outputs.codeRefs); strings(response.outputs.changedPaths, 1);
    same(response.outputs.businessChanged, policy.businessChanged); same(response.outputs.apiCompatible, policy.apiCompatible);
    if (response.outputs.codeRefs.some(c => c.repository !== req.inputs.repository) || response.outputs.changedPaths.some(p => !req.inputs.paths.includes(p))) fail('Support exceeded its exact repository/path scope');
    writeNew(path.join(archive, number + '.response.json'), response); writeNew(path.join(archive, number + '.request.json'), req);
    pending.requests = pending.requests.filter(p => p !== relative);
    if (pending.requests.length) fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2) + '\n'); else fs.unlinkSync(pendingFile);
    return { done: false, waiting: pending.requests.length > 0, remainingSecondary: pending.requests.length, request: reqPath(root, 1), supportResponse: path.join(archive, number + '.response.json'),
      instruction: 'After every required secondary passes, resume FE and recheck integration/render against all backend commits; FE criteria remain unchanged.' };
  });
}
export function main(args) {
  const [command, a, b] = args;
  if (command === 'init' && args.length === 3) return initialize(readJSON(a), b);
  if (command === 'advance' && args.length === 3) return advance(a, readJSON(b));
  if (command === 'status' && args.length === 2) return inspect(a);
  if (command === 'repair' && args.length === 3) return repair(a, readJSON(b));
  if (command === 'support' && args.length === 3) return support(a, readJSON(b));
  if (command === 'resume' && args.length === 3) return resume(a, readJSON(b));
  fail('Usage: node dist/workflows/frontend.mjs init <input.json> <new-run-dir> | advance <run-dir> <response.json> | repair <run-dir> <diagnosis.json> | support <run-dir> <support-input.json> | resume <run-dir> <support-response.json> | status <run-dir>');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = main(process.argv.slice(2)); process.stdout.write(JSON.stringify(result, null, 2) + '\n'); if (result.advanced === false) process.exitCode = 1; }
  catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
