import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { migrationFixture, confirmed } from '../operators/architecture-decide/self-test.mjs';
import { importProducer } from './producer-import.mjs';
import { validateMigrationContract } from './migration-contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const write = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
};

test('operation transport schemas and receipt contracts agree', () => {
  const read = name => JSON.parse(readFileSync(path.join(ROOT, 'templates/kinds', name), 'utf8'));
  const kinds = read('stack-model.schema.json').properties.operations.items.properties.transport.enum;
  assert.deepEqual(read('mutations.schema.json').$defs.operation.properties.transport.enum, kinds);
  for (const file of ['architecture-decision.contract.json', 'backend-source-application.contract.json']) {
    const pattern = read(file).sections.find(section => section.heading === '^## Operations$').cell.Transport;
    assert.equal(pattern, '^(' + kinds.join('|') + ')$');
  }
});

test('imported migration validates original critique and the actual request CLI', async () => {
  const host = mkdtempSync(path.join(tmpdir(), 'migration-contract-'));
  try {
    const root = path.join(host, '.claude');
    for (const folder of ['scripts', 'templates', 'operators', 'resources', 'readiness']) cpSync(path.join(ROOT, folder), path.join(root, folder), { recursive: true });
    cpSync(path.join(ROOT, 'routing.json'), path.join(root, 'routing.json'));
    const sessions = path.join(host, '.worktrees/sessions');
    const original = path.join(sessions, 'original');
    const receiver = path.join(sessions, 'receiver');
    // The done producer is a confirmed re-entry at step-2/parallel-1; the branch it resumes, blocked on
    // RESTATEMENT_UNCONFIRMED, sits at step-1/parallel-1 with the same objective.
    const producer = path.join(original, 'step-2/parallel-1');
    const branch = path.join(receiver, 'step-2/parallel-1');
    const [files, patch] = confirmed(migrationFixture());
    for (const [name, content] of Object.entries(files)) {
      if (name.endsWith('request.json')) content.sessionId = 'original';
      write(path.join(producer, name), content);
    }
    for (const [name, content] of Object.entries(patch.session)) { content.sessionId = 'original'; write(path.join(original, name), content); }
    const state = (id, steps) => ({ id, project: 'fixture', startedAt: '2026-09-04T00:00:00Z', status: 'running', steps, chain: [Object.keys(steps)], requestHashes: {} });
    const originalState = { ...state('original', patch.state.steps), chain: patch.state.chain, current: patch.state.current, resumes: patch.state.resumes, choices: patch.state.choices };
    originalState.requestHashes['2/1'] = hash(readFileSync(path.join(producer, 'request/request.json')));
    originalState.requestHashes['1/1'] = hash(readFileSync(path.join(original, 'step-1/parallel-1/request/request.json')));
    write(path.join(original, 'state.json'), originalState);
    const receiverState = state('receiver', { '2/1': 'backend.generate' });
    write(path.join(receiver, 'state.json'), receiverState);
    await importProducer({ sourceSessionId: 'original', sourceStep: 2, sourceParallel: 1, targetSessionId: 'receiver', targetStep: 100, targetParallel: 1, root, hostRoot: host });
    const request = {
      schemaVersion: 9, operatorId: 'backend.generate', sessionId: 'receiver', step: 2, parallel: 1,
      contexts: [{ alias: '@workspaces/be', head: 'b'.repeat(40) }, { alias: '@worktrees/businesses/fixture', head: null }, { alias: '@knowledge/patterns/be', head: null }],
      requirements: { featureId: 'fixture', outcome: 'add a bounded persistence scope', mutableFileRefs: [files['response/data/stack-model.json'].operations[0].writerRef], contractFingerprint: hash(readFileSync(path.join(producer, 'response/data/stack-model.json'))) },
      inputs: { 'architecture-decision': 'step-100/parallel-1/response/response.md' }, resume: null,
    };
    write(path.join(branch, 'request/request.json'), request);
    receiverState.requestHashes['2/1'] = hash(readFileSync(path.join(branch, 'request/request.json')));
    write(path.join(receiver, 'state.json'), receiverState);
    const checked = await validateMigrationContract(root, branch, request);
    assert.deepEqual(checked.errors, []);
    assert.equal(checked.active, true);
    const concurrent = await Promise.all([validateMigrationContract(root, branch, request), validateMigrationContract(root, branch, request)]);
    assert.deepEqual(concurrent.map(result => result.errors), [[], []], 'independent consumers of one producer may validate concurrently');
    const cli = () => spawnSync(process.execPath, [path.join(root, 'scripts/validate-request.mjs'), branch], { cwd: host, encoding: 'utf8', shell: false, windowsHide: true, timeout: 30000 });
    const accepted = cli();
    assert.equal(accepted.error, undefined);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.match(accepted.stdout, /request valid/);
    const critique = path.join(producer, 'critique/response/critique.md');
    write(critique, readFileSync(critique, 'utf8').replace('| holds |', '| fails |'));
    assert.ok((await validateMigrationContract(root, branch, request)).errors.some(error => error.includes('attacks')));
    const rejected = cli();
    assert.equal(rejected.status, 1, rejected.stderr);
    assert.match(rejected.stderr, /attacks/);
    assert.doesNotMatch(rejected.stderr, /unsettled|top-level await/i);
  } finally {
    if (!path.resolve(host).startsWith(path.resolve(tmpdir()) + path.sep)) throw new Error('unsafe fixture cleanup');
    rmSync(host, { recursive: true, force: true });
  }
});
