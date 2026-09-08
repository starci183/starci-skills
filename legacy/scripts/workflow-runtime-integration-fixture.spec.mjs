import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createSharedSourceFixture, incorporateAndRegress } from './workflow-shared-source-fixture.mjs';
import { git, planCells, read, put } from './workflow-source-fixture.mjs';
import { acceptRuntimeIntegration, INTEGRATION_SERVER_REF, INTEGRATION_SERVER_SOURCE } from './workflow-runtime-integration-fixture.mjs';

test('current runtime operator merges accepted A/B source in a dedicated checkout and serves both through the recorded detached server', { timeout: 600000 }, async t => {
  const f = await createSharedSourceFixture(t, { initialFiles: {
    [INTEGRATION_SERVER_REF]: INTEGRATION_SERVER_SOURCE,
    'package.json': JSON.stringify({ private: true, type: 'module', engines: { node: process.version }, scripts: {
      build: 'node --test src/modules/fixture/worker.spec.mjs', dev: `node ${INTEGRATION_SERVER_REF}`,
    } }, null, 2) + '\n',
  } });
  t.diagnostic('Original current A/B and extracted C source accepted.');
  const a = await incorporateAndRegress(f, f.a);
  t.diagnostic('Consumer A incorporation, source and quality accepted.');
  const b = await incorporateAndRegress(f, f.b);
  t.diagnostic('Consumer B incorporation, source and quality accepted.');
  const worktree = path.join(f.b.home, 'runtime-integration');
  planCells(f.b, [[8, 'api.verify']]);
  let runtime;
  try {
    runtime = await acceptRuntimeIntegration(f.b, { targetHead: a.source.head, baseHead: b.source.head, worktree },
      { t, step: 7, goal: { prerequisite: '8/1' }, coordination: f.at(f.resolved), changes: b.source.changesRef });
    assert.equal(f.b.state().attempts['7/1'].status, 'matched');
    assert.deepEqual(git(worktree, 'show', '-s', '--format=%P', 'HEAD').split(' '), [b.source.head, a.source.head]);
    assert.equal(git(f.b.worktree, 'rev-parse', 'HEAD'), b.source.head);
    assert.equal(runtime.record.worktree, worktree); assert.equal(runtime.record.head, runtime.head);
    assert.notEqual(runtime.record.pid, process.pid);
    assert.equal(runtime.entry.server.pid, runtime.record.pid);
    assert.equal(runtime.entry.server.listenerPid, runtime.record.listenerPid);
    assert.equal(runtime.entry.lease, null);
    const registry = read(runtime.registryFile);
    assert.deepEqual(registry.runtimes[runtime.request.requirements.routeKey], runtime.entry);
    assert.equal(registry.generation, 4);
    const response = await fetch(runtime.endpoint + '?value=joined');
    assert.deepEqual(await response.json(), { value: 'JOINED', consumers: ['consumer-a', 'consumer-b'] });
    const dir = path.join(f.b.session, 'step-7/parallel-1');
    const gates = read(path.join(dir, 'response/data/gates.json'));
    assert.equal(gates.length, 3); assert.ok(gates.every(gate => gate.exitCode === 0 && gate.head === runtime.head));
    assert.match(readFileSync(path.join(dir, 'response/artifacts/both-consumers.log'), 'utf8'), /tests [3-9]/);
    const lease = read(path.join(dir, 'response/data/lease.json'));
    assert.equal(lease.held.sessionId, f.b.sessionId); assert.equal(lease.final, null);
    const { acceptedProducerProof } = await f.b.load('scripts/producer-import.mjs');
    const proof = await acceptedProducerProof(f.root, f.b.sessionId, 7, 1, 'delta', { hostRoot: f.source });
    assert.equal(proof.manifestFingerprint, runtime.proof.manifestFingerprint);
    const original = readFileSync(path.join(dir, 'response/artifacts/both-consumers.log'));
    put(path.join(dir, 'response/artifacts/both-consumers.log'), 'tampered runtime delivery output\n');
    await assert.rejects(acceptedProducerProof(f.root, f.b.sessionId, 7, 1, 'delta', { hostRoot: f.source }), /evidence|manifest|changed/i);
    put(path.join(dir, 'response/artifacts/both-consumers.log'), original);
    await acceptedProducerProof(f.root, f.b.sessionId, 7, 1, 'delta', { hostRoot: f.source });
  } finally { await runtime?.stop(); }
});
