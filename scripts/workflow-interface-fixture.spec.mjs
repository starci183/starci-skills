import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createInterfaceFixture, startInterfaceRuntime, acceptInterfaceRoute, acceptInterface, acceptAudit, acceptInterfaceQuality } from './workflow-interface-fixture.mjs';

test('current interface source changes only its declared action label and carries real browser captures', async t => {
  const f = await createInterfaceFixture(t);
  const runtime = await startInterfaceRuntime(t, f);
  const route = await acceptInterfaceRoute(f);
  const source = await acceptInterface(f, runtime, route);
  const { acceptedProducerProof } = await f.load('scripts/producer-import.mjs');
  const proof = await acceptedProducerProof(f.root, f.sessionId, source.step, 1, 'frontend-source-application', { hostRoot: f.source });
  assert.equal(proof.heads[0], source.head);
  assert.equal(source.captures.length, 2);
  assert.ok(source.captures.every(capture => capture.result.outcome === 'pass'));
  const audit = await acceptAudit(f, runtime, source, route);
  const quality = await acceptInterfaceQuality(f, source, audit);
  await acceptedProducerProof(f.root, f.sessionId, audit.step, 1, 'frontend-surface-audit', { hostRoot: f.source });
  await acceptedProducerProof(f.root, f.sessionId, quality.step, 1, 'quality-verification', { hostRoot: f.source });
  const capture = path.join(f.session, `step-${audit.step}/parallel-1/response/artifacts/narrow-light-error.png`), bytes = readFileSync(capture);
  try {
    writeFileSync(capture, Buffer.concat([bytes, Buffer.from('altered after acceptance')]));
    await assert.rejects(acceptedProducerProof(f.root, f.sessionId, audit.step, 1, 'frontend-surface-audit', { hostRoot: f.source }), /manifest|hash|changed|bytes/i);
  } finally { writeFileSync(capture, bytes); }
  assert.notEqual(f.repository, f.feRepository, 'the fixture has independent actual backend and frontend repositories');
  assert.deepEqual(new Set(audit.captures.map(capture => capture.walk.id.split('-').at(-1))), new Set(['loaded', 'pending', 'error', 'settled']));
});
