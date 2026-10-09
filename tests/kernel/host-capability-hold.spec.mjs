// host-tool-missing: an op that declares a host capability (route.riskHints host-capability-required:render, interface.draw) is held by status and refused by dispatch
// while the host lacks the tool, and neither says anything of an op that declares none. The live sequence is tests/replay/draw-render-tool.spec.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { capabilitiesOf, hostCapabilityGaps } from '../../scripts/kernel/host-capabilities.mjs';
import { prerequisiteDetail } from '../../scripts/kernel/prerequisites.mjs';
import { incidentPolicy } from '../../scripts/kernel/op-incident-policy.mjs';
import { readOpManifest } from '../../scripts/lib/op-shared.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const manifestOf = (op) => readOpManifest(path.join(ROOT, 'modules', 'ops', 'ops', `${op}.yaml`));
const draw = { route: { riskHints: ['host-capability-required:render'] } };

test('interface.draw declares the render capability; an op that declares none, and an agent host tool, are never held', () => {
  assert.deepEqual(capabilitiesOf(manifestOf('interface.draw')), ['host-capability-required:render']);
  assert.deepEqual(capabilitiesOf(manifestOf('brand.decide')), []);
  assert.deepEqual(capabilitiesOf({ route: { riskHints: ['host-tool-required:browser-dom', 'source-edits'] } }), [], 'agent host tools are the other hint');
});

test('a host with no render tool has one gap with the catalogued code and what provisions it; the refusal says nothing was reserved', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-host-capability-'));
  try {
    assert.deepEqual(hostCapabilityGaps({ brief: { route: { riskHints: [] } }, dirs: [dir] }), []);
    const gaps = hostCapabilityGaps({ brief: draw, dirs: [dir], runtime: null });
    assert.equal(gaps.length, 1);
    assert.equal(gaps[0].code, 'RENDER_TOOL_UNAVAILABLE');
    assert.deepEqual(gaps[0].missing, ['playwright', 'esbuild']);
    const detail = prerequisiteDetail({ op: 'interface.draw', jobId: 'job-1', unmet: gaps });
    assert.match(detail, /RENDER_TOOL_UNAVAILABLE: interface\.draw needs the host capability render/);
    assert.match(detail, /The host is not ready/);
    assert.match(detail, /nothing was reserved or launched/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the policy lists host-tool-missing: one handler, the Supervisor, a bound, and the owner last; the gate for an environment blocker names the host', () => {
  const hold = incidentPolicy().holds.find((row) => row.id === 'host-tool-missing');
  assert.equal(hold.queuedBecause, 'host-tool-missing');
  assert.equal(hold.handler, 'supervisor');
  assert.equal(hold.chain.at(-1), 'owner');
  assert.ok(incidentPolicy().gateCauses.some((cause) => cause.id === 'host-not-ready'));
});
