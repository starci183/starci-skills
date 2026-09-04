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
      const key = `${request.step}/${request.parallel}${request.exchange ? `/${request.exchange}` : ''}`;
      const expected = state.requestHashes?.[key];
      if (expected) {
        const { createHash } = await import('node:crypto');
        const actual = `sha256:${createHash('sha256').update(await readFile(file)).digest('hex')}`;
        if (actual !== expected) errors.push(`request.json: hash ${actual} differs from state.json requestHashes[${key}]`);
      }
    } catch (e) { errors.push(`state.json: ${e.message}`); }
  }
  errors.push(...selectionErrors(await loadInteractionPolicy(root), request, recordedChoices));
  if (!errors.length && request.operatorId === 'backend.source.apply') {
    const { validateMigrationContract } = await import('./migration-contract.mjs');
    errors.push(...(await validateMigrationContract(root, dir, request)).errors);
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
