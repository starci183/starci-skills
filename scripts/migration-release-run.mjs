// Fixed transport for a source-owned migration runner. No shell, caller argv, SQL or secret resolver.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateRequest } from './validate-request.mjs';
import { validateAgainst } from './json-schema.mjs';
import { validateMigrationReleaseRequest, migrationPath, migrationDigest, migrationRunnerErrors, migrationExecutionErrors, migrationReleaseProofErrors } from './migration-release.mjs';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
class Refused extends Error { constructor(code, evidence = {}) { super(code); this.evidence = evidence; } }
const requireThat = (condition, code) => { if (!condition) throw new Refused(code); };
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

export async function executeMigrationRelease(root, branchDir) {
  root = path.resolve(root); branchDir = path.resolve(branchDir);
  let attempted = false, completed = false;
  try {
    const request = readJson(migrationPath(branchDir, 'request/request.json'));
    const session = path.resolve(branchDir, '..', '..'), key = `${request.step}/${request.parallel}`;
    const state = readJson(migrationPath(session, 'state.json'));
    requireThat(state.id === request.sessionId && state.steps?.[key] === 'migration.release'
      && state.requestHashes?.[key] === migrationDigest(fs.readFileSync(migrationPath(branchDir, 'request/request.json'))), 'REQUEST_NOT_FROZEN');
    const gated = await validateRequest(root, branchDir);
    requireThat(!gated.errors.length, 'REQUEST_INVALID');
    let binding = await validateMigrationReleaseRequest(root, branchDir, request);
    requireThat(binding.active && !binding.errors.length, 'MIGRATION_RELEASE_GATE_FAILED');
    const { plan, planSha256, checkout } = binding;
    const deadline = Date.now() + Number(request.requirements.steadyDeadline ?? 600) * 1000;
    for (const dir of ['response', 'response/data', 'response/artifacts']) {
      fs.mkdirSync(path.join(branchDir, dir), { recursive: true }); migrationPath(branchDir, dir);
    }
    for (const file of ['response/migration-release.md', 'response/data/migration-release.json', 'response/artifacts/migration-1.log', 'response/artifacts/migration-2.log']) {
      requireThat(!fs.existsSync(path.join(branchDir, file)), 'MIGRATION_EVIDENCE_ALREADY_EXISTS');
    }
    const runnerFile = migrationPath(checkout, plan.runner.path);
    let expected = { journalExists: plan.journalExistsBefore, journal: plan.journalBefore, journalFingerprint: plan.journalFingerprintBefore, pending: plan.migrations.map((item) => item.name) };
    const execute = async (operation) => {
      // Re-read request, approval, source, runner and configuration immediately before every effect.
      if (operation === 'apply') {
        const currentState = readJson(migrationPath(session, 'state.json'));
        requireThat(currentState.steps?.[key] === 'migration.release' && currentState.requestHashes?.[key] === state.requestHashes[key]
          && state.requestHashes[key] === migrationDigest(fs.readFileSync(migrationPath(branchDir, 'request/request.json'))), 'REQUEST_DRIFT');
        binding = await validateMigrationReleaseRequest(root, branchDir, request);
        requireThat(!binding.errors.length && binding.planSha256 === planSha256 && binding.checkout === checkout, 'PREFLIGHT_DRIFT');
      }
      const payload = { schemaVersion: 1, operation, planSha256, sourceHead: plan.sourceHead,
        connectionRef: plan.connectionRef, connectionFingerprint: plan.connectionFingerprint,
        migrations: plan.migrations, journal: plan.journal, expected };
      requireThat(!validateAgainst(readJson(path.join(root, 'templates/kinds/migration-release-input.schema.json')), payload).length, 'RUNNER_INPUT_INVALID');
      const input = JSON.stringify(payload);
      const timeout = deadline - Date.now(); requireThat(timeout > 0, 'MIGRATION_DEADLINE');
      const env = { ...process.env }; delete env.NODE_OPTIONS; delete env.NODE_PATH;
      let result;
      if (operation === 'apply') attempted = true;
      try {
        const child = execFile(process.execPath, [runnerFile], { cwd: checkout, env, timeout, maxBuffer: 1024 * 1024, windowsHide: true, encoding: 'utf8' });
        let stdout = '', stderr = '', inputError = false;
        const finished = new Promise((resolve) => { child.once('error', () => resolve({ code: null, signal: 'spawn-error' })); child.once('close', (code, signal) => resolve({ code, signal })); });
        child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
        child.stdin.on('error', () => { inputError = true; child.kill(); });
        child.stdin.end(input + '\n');
        const exit = await finished; result = { ...exit, stdout, stderr, inputError };
      } catch { throw new Refused('RUNNER_UNAVAILABLE'); }
      const hashes = { stdoutSha256: migrationDigest(result.stdout), stderrSha256: migrationDigest(result.stderr) };
      requireThat(Date.now() <= deadline, 'MIGRATION_DEADLINE');
      if (result.inputError) throw new Refused('RUNNER_INPUT_FAILED', hashes);
      if (result.code !== 0 || result.signal || result.stderr.length) throw new Refused('RUNNER_FAILED', hashes);
      let value; try { value = JSON.parse(result.stdout); } catch { throw new Refused('RUNNER_OUTPUT_INVALID', hashes); }
      if (migrationRunnerErrors(root, plan, planSha256, value, operation).length) throw new Refused('RUNNER_OUTPUT_INVALID', hashes);
      return { value, stdout: result.stdout };
    };
    const executions = [];
    for (let invocation = 1; invocation <= 2; invocation += 1) {
      const before = await execute('inspect');
      requireThat(same(before.value.journalAfter, expected.journal) && before.value.journalExistsAfter === expected.journalExists
        && before.value.journalFingerprintAfter === expected.journalFingerprint && same(before.value.pendingAfter, expected.pending), 'JOURNAL_OR_PENDING_DRIFT');
      const applied = await execute('apply');
      requireThat(!migrationExecutionErrors(plan, applied.value, expected, invocation === 2).length, 'APPLIED_SCOPE_UNPROVEN');
      expected = { journalExists: applied.value.journalExistsAfter, journal: applied.value.journalAfter, journalFingerprint: applied.value.journalFingerprintAfter, pending: [] };
      const after = await execute('inspect');
      requireThat(same(after.value.journalAfter, expected.journal) && after.value.journalExistsAfter === expected.journalExists
        && after.value.journalFingerprintAfter === expected.journalFingerprint && !after.value.pendingAfter.length, 'MIGRATION_READBACK_UNPROVEN');
      const logRef = `response/artifacts/migration-${invocation}.log`;
      const log = JSON.stringify([before.stdout, applied.stdout, after.stdout]) + '\n';
      fs.writeFileSync(path.join(branchDir, logRef), log, { flag: 'wx' });
      const fields = ['applied', 'pendingBefore', 'pendingAfter', 'journalExistsBefore', 'journalExistsAfter', 'journalBefore', 'journalAfter', 'journalFingerprintBefore', 'journalFingerprintAfter', 'preservedJournalFingerprint'];
      executions.push({ invocation, ...Object.fromEntries(fields.map((field) => [field, applied.value[field]])), exitCode: 0, logRef, logSha256: migrationDigest(log) });
    }
    const proof = { schemaVersion: 1, outcome: 'migrated', planSha256, sourceHead: plan.sourceHead, contractFingerprint: plan.contractFingerprint,
      connectionFingerprint: plan.connectionFingerprint, journalExistsBefore: plan.journalExistsBefore, journalExistsAfter: expected.journalExists,
      journalBefore: plan.journalBefore, journalAfter: expected.journal, journalFingerprintBefore: plan.journalFingerprintBefore,
      journalFingerprintAfter: expected.journalFingerprint, executions };
    requireThat(!migrationReleaseProofErrors(root, branchDir, plan, planSha256, proof).length, 'MIGRATION_PROOF_INVALID');
    fs.writeFileSync(path.join(branchDir, 'response/data/migration-release.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
    const bindingRows = { Operator: 'migration.release', Step: `step-${request.step}/parallel-${request.parallel}`, Project: plan.project, Environment: plan.env,
      Target: plan.target, Release: request.requirements.release, 'Source head': plan.sourceHead, 'Plan digest': planSha256,
      'Contract fingerprint': plan.contractFingerprint, Approval: request.requirements.approval, 'Connection fingerprint': plan.connectionFingerprint };
    const receipt = `# migration-release — ${request.requirements.release}\n\n## Binding\n\n| Field | Value |\n| --- | --- |\n${Object.entries(bindingRows).map(([field, value]) => `| ${field} | ${value} |`).join('\n')}\n\n## Outcome\n\n| Field | Value |\n| --- | --- |\n| Outcome | migrated |\n| Journal before | ${proof.journalFingerprintBefore} |\n| Journal after | ${proof.journalFingerprintAfter} |\n| Replay | no-op |\n\n## Executions\n\n| Invocation | Applied migrations | Exit code | Log | Digest |\n| --- | --- | --- | --- | --- |\n${executions.map((entry) => `| ${entry.invocation} | ${entry.applied.join(', ') || '—'} | 0 | \`${entry.logRef}\` | \`${entry.logSha256}\` |`).join('\n')}\n`;
    fs.writeFileSync(path.join(branchDir, 'response/migration-release.md'), receipt, { flag: 'wx' });
    completed = true;
    return { status: 'done', outcome: 'migrated', receipt: 'response/migration-release.md', proof: 'response/data/migration-release.json' };
  } catch (error) {
    return { status: 'blocked', code: error instanceof Refused ? error.message : 'MIGRATION_RELEASE_UNAVAILABLE', partialMutation: completed ? true : attempted ? 'unknown' : false, ...(error instanceof Refused ? error.evidence : {}) };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [root, branch] = process.argv.slice(2);
  const result = root && branch ? await executeMigrationRelease(root, branch) : { status: 'blocked', code: 'USAGE', partialMutation: false };
  process.stdout.write(JSON.stringify(result) + '\n'); if (result.status !== 'done') process.exitCode = 1;
}
