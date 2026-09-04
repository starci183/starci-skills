// A migration release consumes proved source; it never resolves an arbitrary checkout or command.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { AsyncLocalStorage } from 'node:async_hooks';
import { validateAgainst } from './json-schema.mjs';
import { validateImportedInput } from './producer-import.mjs';
import { loadEnvironmentSchema, parseDeclarationReference, stackDeclaration } from './validate-request.mjs';
import { tableUnder } from './validate-response.mjs';

export const migrationDigest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
export const migrationNames = (values) => [...values].sort();
export const migrationConnectionFingerprint = (connection) => migrationDigest(JSON.stringify(Object.fromEntries(
  ['driver', 'host', 'port', 'database', 'schema', 'username'].map((key) => [key, connection[key]]))));
export function migrationJournalFingerprint(rows) {
  const exact = (value, minimum) => {
    fail((typeof value === 'number' && Number.isSafeInteger(value)) || typeof value === 'bigint'
      || (typeof value === 'string' && /^(?:0|[1-9][0-9]*)$/.test(value)), 'journal integer is not exact');
    const integer = BigInt(value);
    fail(integer >= BigInt(minimum) && integer <= BigInt(Number.MAX_SAFE_INTEGER), 'journal integer is outside the safe range');
    return Number(integer);
  };
  const normalized = rows.map((row) => ({ id: exact(row.id, 1), timestamp: exact(row.timestamp, 0), name: row.name })).sort((a, b) => a.id - b.id);
  fail(normalized.every((row) => typeof row.name === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(row.name))
    && new Set(normalized.map((row) => row.id)).size === normalized.length && new Set(normalized.map((row) => row.name)).size === normalized.length, 'journal identities are invalid or repeated');
  return migrationDigest(JSON.stringify(normalized));
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const active = new AsyncLocalStorage();
const fail = (condition, message) => { if (!condition) throw Error(message); };
const normalized = (value) => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);

export function migrationPath(base, relative) {
  fail(typeof relative === 'string' && relative.length > 0 && !/[\\:\0]/.test(relative)
    && !path.isAbsolute(relative) && !relative.split('/').some((part) => !part || part === '.' || part === '..'), 'unsafe migration path');
  fail(!fs.lstatSync(base).isSymbolicLink(), 'migration symlinks are forbidden');
  const realBase = fs.realpathSync(base);
  let file = base;
  for (const part of relative.split('/')) {
    file = path.join(file, part);
    fail(!fs.lstatSync(file).isSymbolicLink(), 'migration symlinks are forbidden');
    const rel = path.relative(realBase, fs.realpathSync(file));
    fail(rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel), 'migration path escaped its root');
  }
  return file;
}

async function producer(root, session, reference, kind, operatorId, sessionId) {
  const match = /^(step-([1-9]\d*)\/parallel-([1-9]\d*))\/(response\/(?:response\.md|data\/route\.json))$/.exec(reference ?? '');
  fail(match, `migration release requires a ${kind} producer reference`);
  const errors = await validateImportedInput(root, session, reference, kind, { receivingSessionId: sessionId });
  fail(!errors.length, errors.join('; '));
  const copied = migrationPath(session, match[1]);
  let originSession = session, relative = match[1], step = Number(match[2]), parallel = Number(match[3]);
  if (fs.existsSync(path.join(copied, 'import.json'))) {
    const manifest = json(migrationPath(copied, 'import.json'));
    originSession = migrationPath(path.dirname(root), `.worktrees/sessions/${manifest.sourceSessionId}`);
    sessionId = manifest.sourceSessionId; step = manifest.sourceStep; parallel = manifest.sourceParallel;
    relative = `step-${step}/parallel-${parallel}`;
  }
  const branch = migrationPath(originSession, relative), reqFile = migrationPath(branch, 'request/request.json');
  const request = json(reqFile), response = json(migrationPath(branch, 'response/response.json'));
  fail(request.operatorId === operatorId && response.operatorId === operatorId && response.status === 'done'
    && request.sessionId === sessionId && request.step === step && request.parallel === parallel
    && response.step === step && response.parallel === parallel && !request.exchange && !response.exchange,
  `${kind} must come from its named completed operator`);
  fail(response.fields?.[kind] === match[4], `${kind} is not the exact emitted producer output`);
  const state = json(migrationPath(originSession, 'state.json')), key = `${step}/${parallel}`;
  fail(state.id === sessionId && state.steps?.[key] === operatorId
    && state.requestHashes?.[key] === migrationDigest(fs.readFileSync(reqFile)), `${kind} producer request is not frozen`);
  for (const refs of Object.values(response.fields ?? {})) for (const ref of Array.isArray(refs) ? refs : [refs]) migrationPath(branch, ref);
  fail(migrationDigest(fs.readFileSync(migrationPath(copied, match[4]))) === migrationDigest(fs.readFileSync(migrationPath(branch, match[4]))), `${kind} producer bytes changed`);
  return { branch, request, response, file: migrationPath(branch, match[4]) };
}

export async function validateMigrationReleaseRequest(root, branchDir, request) {
  const result = { errors: [], active: request?.operatorId === 'release.deploy' && request.requirements?.migration != null, plan: null, checkout: null, planSha256: null };
  if (!result.active) return result;
  const key = normalized(branchDir);
  const ancestors = active.getStore() ?? new Set();
  if (ancestors.has(key)) return { ...result, errors: ['cyclic migration release producer'] };
  return active.run(new Set([...ancestors, key]), async () => {
  try {
    const req = request.requirements, binding = req.migration;
    fail(binding && same(Object.keys(binding).sort(), ['planRef', 'sha256']) && binding.planRef === 'request/migration-release.json', 'migration binding must pin request/migration-release.json by sha256');
    const bytes = fs.readFileSync(migrationPath(branchDir, binding.planRef));
    const plan = JSON.parse(bytes.toString('utf8')); result.planSha256 = migrationDigest(bytes);
    fail(binding.sha256 === result.planSha256, 'migration plan digest changed');
    const errors = validateAgainst(json(path.join(root, 'templates/kinds/migration-release-plan.schema.json')), plan, 'migration release plan');
    fail(!errors.length, errors.join('; ')); result.plan = plan;
    fail(req.target === plan.target, 'migration target differs from the request');
    fail(/^release:[A-Za-z0-9._-]+$/.test(req.release ?? ''), 'migration release identity is missing');
    fail(req.rollbackIdentity == null && !(req.probes?.length), 'migration release carries image rollback or rollout probes');
    fail(Number(req.steadyDeadline ?? 600) > 0 && Number.isFinite(Number(req.steadyDeadline ?? 600)), 'migration deadline must be positive');
    const declaration = await stackDeclaration(root, plan.env);
    fail(declaration.exists && !declaration.errors.length && declaration.declaration.production === false, 'migration release requires an existing non-production environment declaration');
    fail(declaration.hash === plan.environmentSha256, 'migration environment declaration changed');
    const targets = (declaration.declaration.migrationTargets ?? []).filter((target) => target.project === plan.project && target.target === plan.target && target.connectionRef === plan.connectionRef);
    fail(targets.length === 1, 'migration target must match exactly one authoritative environment connection');
    const target = targets[0], connection = target.connection;
    const authoritativeFingerprint = connection.usernameRef ? target.connectionFingerprint : migrationConnectionFingerprint(connection);
    fail(authoritativeFingerprint === plan.connectionFingerprint && (!target.connectionFingerprint || target.connectionFingerprint === authoritativeFingerprint)
      && connection.schema === plan.journal.schema, 'migration connection or journal schema differs from environment authority');
    fail(typeof req.approval === 'string' && req.approval.trim() && req.approval !== '—', 'migration release requires explicit release approval');
    const ref = parseDeclarationReference(await loadEnvironmentSchema(root), req.approval);
    if (ref) fail(ref.env === plan.env && ref.hash === declaration.hash && declaration.authorization.release === 'declared', 'environment declaration does not authorize this release or its hash changed');
    else fail(!req.approval.startsWith('.stacks/') && !req.approval.startsWith('secret-ref://'), 'migration release approval is neither an approval id nor a valid declaration reference');
    fail(plan.journalExistsBefore || (!plan.journalBefore.length && plan.journal.allowInitialization), 'absent journal requires empty history and explicit initialization');
    fail(plan.journalExistsBefore || plan.journalFingerprintBefore === migrationDigest('[]'), 'absent journal fingerprint must describe an empty journal');
    fail(!plan.migrations.some((item) => plan.journalBefore.includes(item.name)), 'migration plan must declare the complete pending set');
    for (const names of [plan.journalBefore, plan.migrations.map((item) => item.name)]) fail(same(names, migrationNames(names)) && new Set(names).size === names.length, 'migration identities must be unique and sorted');
    const session = path.resolve(branchDir, '..', '..');
    const route = await producer(root, session, request.inputs?.route, 'route', 'workspace.bind', request.sessionId);
    const backend = await producer(root, session, request.inputs?.['backend-source-application'], 'backend-source-application', 'backend.source.apply', request.sessionId);
    const quality = await producer(root, session, request.inputs?.['quality-verification'], 'quality-verification', 'quality.verify', request.sessionId);
    const { validateWorkspaceStep } = await import('../operators/workspace-bind/validate.mjs');
    const { validateBackendStep } = await import('../operators/backend-source-apply/validate.mjs');
    const { validateQualityStep } = await import('../operators/quality-verify/validate.mjs');
    for (const [entry, validate] of [[route, validateWorkspaceStep], [backend, validateBackendStep], [quality, validateQualityStep]]) {
      const checked = await validate(entry.branch, root); fail(!checked.errors.length, `migration producer invalid: ${checked.errors.join('; ')}`);
    }
    const routed = json(route.file);
    fail(routed.project === plan.project && routed.role === 'be' && routed.sourceHead === plan.sourceHead, 'migration route project, role or source head differs');
    fail(request.contexts?.some((context) => context.alias === '@workspaces/be' && context.head === plan.sourceHead), 'migration source context is not pinned');
    const mutations = json(migrationPath(backend.branch, 'response/data/mutations.json'));
    fail(mutations.mode === 'apply' && mutations.commit === plan.sourceHead && mutations.contractFingerprint === plan.contractFingerprint, 'migration backend receipt is dry, stale or measured against another contract');
    fail(mutations.operations.length && mutations.operations.every((operation) => operation.transport === 'migration'), 'migration release requires only migration operations');
    const refs = [...new Set(mutations.operations.flatMap((operation) => operation.migrationRefs))].sort();
    fail(same(refs, plan.migrations.map((item) => item.path).sort()), 'migration files differ from the frozen backend operations');
    const mutable = new Set(backend.request.requirements.mutableFileRefs);
    fail(mutable.has(plan.runner.path), 'migration runner is outside the backend source ceiling');
    for (const file of [plan.runner, ...plan.migrations]) fail(mutations.changes.some((change) => change.path === file.path && change.afterHash === file.sha256), 'migration runner or migration file lacks its backend source change proof');
    const qtext = fs.readFileSync(quality.file, 'utf8');
    fail(Object.fromEntries(tableUnder(qtext, '## Gate verdict') ?? []).Verdict === 'pass', 'migration quality verdict did not pass');
    const gateRefs = quality.response.fields?.['gate-result'];
    fail(Array.isArray(gateRefs) && gateRefs.length, 'migration quality has no measured gates');
    let passedRequiredGate = false;
    for (const ref of gateRefs) {
      const gate = json(migrationPath(quality.branch, ref));
      fail(gate.sourceHead === plan.sourceHead && gate.predecessorCommit === plan.sourceHead && (!gate.required || gate.status === 'pass'), 'migration quality gates did not pass on this source head');
      if (gate.required === true && gate.status === 'pass') passedRequiredGate = true;
    }
    fail(passedRequiredGate, 'migration quality requires an actual passing required gate');
    const checkout = fs.realpathSync(routed.checkout.diskPath); result.checkout = checkout;
    const git = (...args) => execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    fail(normalized(git('rev-parse', '--show-toplevel')) === normalized(checkout) && git('rev-parse', 'HEAD') === plan.sourceHead, 'migration checkout head changed');
    fail(!git('status', '--porcelain', '--untracked-files=all'), 'migration checkout contains uncommitted files');
    fail(plan.runner.path.endsWith('.mjs'), 'migration runner must be a pinned JavaScript module');
    const pinnedFiles = [plan.runner, ...plan.configuration, ...plan.migrations];
    fail(new Set(pinnedFiles.map((file) => file.path)).size === pinnedFiles.length, 'migration artifact repeats a file');
    fail(plan.configuration.some((file) => file.path === 'package.json') && plan.configuration.some((file) => file.path === 'package-lock.json'), 'migration configuration must pin its package manifest and lockfile');
    for (const file of pinnedFiles) {
      const actual = fs.readFileSync(migrationPath(checkout, file.path));
      fail(migrationDigest(actual) === file.sha256, 'migration runner, configuration or source file hash changed');
      const frozen = execFileSync('git', ['-C', checkout, 'show', `${plan.sourceHead}:${file.path}`], { stdio: ['ignore', 'pipe', 'pipe'] });
      fail(migrationDigest(frozen) === file.sha256, 'migration artifact differs from its source commit');
    }
  } catch (error) { result.errors.push(`migration release: ${error.message}`); }
  return result;
  });
}

export function migrationRunnerErrors(root, plan, planSha256, value, operation) {
  const errors = validateAgainst(json(path.join(root, 'templates/kinds/migration-release-runner.schema.json')), value, 'migration runner');
  if (errors.length) return errors;
  for (const field of ['journalBefore', 'journalAfter', 'pendingBefore', 'pendingAfter', 'applied']) if (!same(value[field], migrationNames(value[field]))) errors.push(`migration runner ${field} is not sorted`);
  if (value.operation !== operation || value.planSha256 !== planSha256 || value.sourceHead !== plan.sourceHead || value.connectionFingerprint !== plan.connectionFingerprint) errors.push('migration runner identity differs from the frozen plan');
  if (operation === 'inspect' && (!same(value.journalBefore, value.journalAfter) || !same(value.pendingBefore, value.pendingAfter) || value.applied.length || value.journalExistsBefore !== value.journalExistsAfter || value.journalFingerprintBefore !== value.journalFingerprintAfter)) errors.push('migration inspect performed a mutation');
  if (value.preservedJournalFingerprint !== value.journalFingerprintBefore) errors.push('migration rewrote prior journal rows');
  if (!value.journalExistsBefore && value.journalBefore.length) errors.push('absent migration journal carries history');
  if (!value.journalExistsAfter && value.journalAfter.length) errors.push('absent migration journal carries new history');
  return errors;
}

export function migrationExecutionErrors(plan, value, expected, replay = false) {
  const errors = [];
  const planned = plan.migrations.map((item) => item.name);
  const pending = planned.filter((name) => !expected.journal.includes(name));
  if (!same(value.journalBefore, expected.journal) || value.journalExistsBefore !== expected.journalExists || value.journalFingerprintBefore !== expected.journalFingerprint || !same(value.pendingBefore, pending)) errors.push('migration journal or exact pending set drifted');
  if (value.preservedJournalFingerprint !== expected.journalFingerprint) errors.push('migration rewrote prior journal rows');
  if (!same(value.applied, pending) || value.pendingAfter.length || !same(value.journalAfter, migrationNames([...expected.journal, ...pending]))) errors.push('migration applied set or resulting journal differs from the frozen set');
  if (pending.length && value.journalFingerprintAfter === value.journalFingerprintBefore) errors.push('migration applied without advancing the journal revision');
  if (!value.journalExistsAfter || (!value.journalExistsBefore && !plan.journal.allowInitialization)) errors.push('migration journal initialization is unproved or unauthorized');
  if (replay && (value.applied.length || !same(value.journalBefore, value.journalAfter) || value.journalExistsBefore !== value.journalExistsAfter || value.journalFingerprintBefore !== value.journalFingerprintAfter)) errors.push('migration replay did not prove a no-op');
  return errors;
}

export function migrationReleaseProofErrors(root, branchDir, plan, planSha256, proof) {
  const errors = validateAgainst(json(path.join(root, 'templates/kinds/migration-release-proof.schema.json')), proof, 'migration release proof');
  if (errors.length) return errors;
  if (proof.planSha256 !== planSha256 || proof.sourceHead !== plan.sourceHead || proof.contractFingerprint !== plan.contractFingerprint || proof.connectionFingerprint !== plan.connectionFingerprint) errors.push('migration proof identity differs from the plan');
  let expected = { journal: plan.journalBefore, journalExists: plan.journalExistsBefore, journalFingerprint: plan.journalFingerprintBefore };
  for (const [index, execution] of proof.executions.entries()) {
    if (execution.invocation !== index + 1 || execution.logRef !== `response/artifacts/migration-${index + 1}.log`) errors.push('migration invocation order or log path is wrong');
    errors.push(...migrationExecutionErrors(plan, execution, expected, index === 1));
    try {
      const bytes = fs.readFileSync(migrationPath(branchDir, execution.logRef));
      if (migrationDigest(bytes) !== execution.logSha256) errors.push('migration log bytes changed');
      const captures = JSON.parse(bytes.toString('utf8'));
      fail(Array.isArray(captures) && captures.length === 3 && captures.every((item) => typeof item === 'string'), 'migration log must preserve three raw stdout captures');
      const values = captures.map((raw) => JSON.parse(raw));
      for (const [i, value] of values.entries()) errors.push(...migrationRunnerErrors(root, plan, planSha256, value, i === 1 ? 'apply' : 'inspect'));
      const [before, applied, after] = values;
      for (const field of ['journalBefore', 'journalAfter', 'pendingBefore', 'pendingAfter', 'applied', 'journalExistsBefore', 'journalExistsAfter', 'journalFingerprintBefore', 'journalFingerprintAfter', 'preservedJournalFingerprint']) if (!same(applied[field], execution[field])) errors.push(`migration proof ${field} differs from captured runner output`);
      if (!same(before.journalAfter, applied.journalBefore) || before.journalExistsAfter !== applied.journalExistsBefore || !same(before.pendingAfter, applied.pendingBefore)
        || before.journalFingerprintAfter !== applied.journalFingerprintBefore || after.journalFingerprintBefore !== applied.journalFingerprintAfter
        || !same(after.journalBefore, applied.journalAfter) || after.journalExistsBefore !== applied.journalExistsAfter || !same(after.pendingBefore, applied.pendingAfter)) errors.push('migration inspections do not prove the applied boundary');
    } catch { errors.push('migration raw stdout transcript is missing or malformed'); }
    expected = { journal: execution.journalAfter, journalExists: execution.journalExistsAfter, journalFingerprint: execution.journalFingerprintAfter };
  }
  if (!same(proof.journalBefore, plan.journalBefore) || proof.journalExistsBefore !== plan.journalExistsBefore || !same(proof.journalAfter, expected.journal) || proof.journalExistsAfter !== expected.journalExists || proof.journalFingerprintBefore !== plan.journalFingerprintBefore || proof.journalFingerprintAfter !== expected.journalFingerprint) errors.push('migration proof journal summary differs from its executions');
  return errors;
}
