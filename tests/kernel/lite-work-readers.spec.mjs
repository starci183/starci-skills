import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { committedReader, createOwnership } from '../../scripts/kernel/work-ownership.mjs';
import { proposedLegPaths } from '../../scripts/kernel/leg-proposal.mjs';
import { findRecord, resolveRootOwner } from '../../scripts/kernel/verify-failure.mjs';
import { checkPrerequisites, designVerdicts, directionVerdicts } from '../../scripts/kernel/prerequisites.mjs';
import { shellFoundationNeed } from '../../scripts/kernel/shell-foundation.mjs';
import { evaluateCondition } from '../../scripts/kernel/gate-conditions.mjs';
import { buildOpPrompt } from '../../scripts/kernel/op-prompt.mjs';
import { acceptanceTraceOf } from '../../scripts/kernel/acceptance-trace.mjs';
import { judgeGate, namedPaths } from '../../scripts/supervisor/stall.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const feature = '.starciwork/features/health';
const impl = `${feature}/impl/be/check`;
const ui = `${feature}/ui/check`;
const write = (repo, rel, text) => {
  const file = path.join(repo, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const app = (t, edition = 'lite') => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-lite-kernel-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  write(repo, 'hfs.json', JSON.stringify({ kind: 'app', edition }));
  write(repo, '.starciwork/index.yaml', 'schema: work/catalog@1\nfeatures: [{id: health, directory: features/health}]\n');
  write(repo, '.starciwork/workspace.yaml', 'repositories: [{name: be, role: be}]\n');
  write(repo, `${feature}/index.yaml`, 'schema: work/feature@1\nid: health\nextensions: {work3: {scope: {request: {workflow: wf-feature}}}}\n');
  write(repo, `${impl}/index.yaml`, 'schema: work/implementation@1\nid: impl.health.be.check\nrepository: be\nproves: [ui.health.check]\n');
  write(repo, `${ui}/index.yaml`, 'schema: work/ui-screen@1\nid: ui.health.check\nstate: todo\nroute: /check\n');
  write(repo, '.starciwork/brand/index.yaml', 'schema: work/brand@1\nid: brand\nstate: done\nrev: 2\n');
  return repo;
};
const db = {
  prepare(sql) {
    return {
      all() {
        return sql.includes('FROM workflows ORDER BY') ? [
          { workflow_id: 'wf-base', phase: 'running', archived_at: null, created_at: 1 },
          { workflow_id: 'wf-feature', phase: 'running', archived_at: null, created_at: 2 },
        ] : [];
      },
      get() { return null; },
    };
  },
};

test('lite ignores stale catalog ownership and feature write proposals; full keeps them', (t) => {
  for (const edition of ['lite', 'full']) {
    const repo = app(t, edition), owner = createOwnership(db, { repo, foundations: [] })(`${impl}/index.yaml`);
    assert.equal(owner.workflowId, edition === 'lite' ? 'wf-base' : 'wf-feature');
    const proposed = proposedLegPaths({ skillRoot: ROOT, op: 'backend.implement', trees: [repo], nodePaths: [impl] });
    if (edition === 'lite') assert.equal(proposed, '', 'a stale node path cannot propose forbidden feature or resource writes');
    else assert.ok(proposed.includes(`${feature}/impl`));
  }
});

test('lite root-cause resolution does not use stale workspace or feature records', (t) => {
  for (const edition of ['lite', 'full']) {
    const repo = app(t, edition), record = findRecord(repo, 'impl.health.be.check');
    const result = resolveRootOwner({ repo, rootCause: { node: 'impl.health.be.check' }, kinds: { kinds: { 'backend.implement': { family: 'build' } } } });
    if (edition === 'lite') {
      assert.equal(record, null);
      assert.equal(result, null);
    } else {
      assert.equal(record, path.join(repo, impl, 'index.yaml'));
      assert.equal(result.op, 'backend.implement');
      assert.equal(result.role, 'be');
    }
  }
});

test('a committed lite reader drops forbidden metadata before a git read', (t) => {
  const repo = app(t);
  const records = committedReader(repo)(['.starciwork/workspace.yaml', '.starciwork/index.yaml', `${feature}/index.yaml`]);
  assert.deepEqual([...records], [], 'an uncommitted lite app needs no git lookup for forbidden metadata');
});

test('lite acceptance tracing skips explicit owned feature indexes', (t) => {
  for (const edition of ['lite', 'full']) {
    const repo = app(t, edition);
    write(repo, `${feature}/index.yaml`, 'schema: work/feature@1\nid: health\nproves: [ac.health.activate.allowed]\n');
    const trace = acceptanceTraceOf({ roots: [repo], owned: [`${feature}/index.yaml`] });
    assert.equal(trace.total, edition === 'lite' ? 0 : 1);
  }
});

test('lite prerequisites skip forbidden shell and feature reads while retaining brand and ordinary requirements', (t) => {
  const repo = app(t), brief = { reads: [
    { id: 'shell', path: '.starciwork/shell/index.yaml', mustExist: true, layoutFoundation: true },
    { id: 'design', designDrawn: true },
    { id: 'direction', directionArchetype: true },
    { id: 'brand', path: '.starciwork/brand/index.yaml', mustExist: true },
    { id: 'ordinary', path: 'required.yaml', mustExist: true },
  ] };
  const payload = { records: [impl], owned_paths: [ui] };
  assert.deepEqual(checkPrerequisites({ brief, payload, repo }).unmet, [{ kind: 'record-missing', read: 'ordinary', path: 'required.yaml' }]);
  assert.deepEqual(designVerdicts(repo, [impl]), []);
  assert.deepEqual(directionVerdicts(repo, [ui]), []);
  assert.equal(shellFoundationNeed({ brief, payload, repo }), null);
  fs.unlinkSync(path.join(repo, '.starciwork/brand/index.yaml'));
  assert.ok(checkPrerequisites({ brief, payload, repo }).unmet.some(item => item.read === 'brand'), 'lite brand prerequisites still apply');
  write(repo, 'hfs.json', JSON.stringify({ kind: 'app', edition: 'full' }));
  assert.ok(checkPrerequisites({ brief, payload, repo }).unmet.some(item => item.read === 'shell'));
  assert.equal(designVerdicts(repo, [impl])[0].unsettled, true);
  assert.equal(shellFoundationNeed({ brief, payload, repo }).needed, true);
});

test('forbidden lite record waits are obsolete even when stale bytes exist; brand waits still work', (t) => {
  const repo = app(t), cond = { type: 'record', path: `${feature}/index.yaml` };
  const result = evaluateCondition(db, cond, { repo });
  assert.equal(result.met, false);
  assert.match(result.unmeetable, /lite \.starciwork holds only brand\//);
  assert.equal(evaluateCondition(db, { type: 'record', path: '.starciwork/brand', state: 'done', minRev: 2 }, { repo }).met, true);
  write(repo, '.starciwork/index.yaml', 'schema: work/catalog@1\nstate: done\nrev: 2\n');
  assert.match(evaluateCondition(db, { type: 'record', path: '.starciwork', state: 'done', minRev: 2 }, { repo }).unmeetable, /lite \.starciwork holds only brand\//);
  const gate = { text: `Wait for ${feature}/index.yaml`, holds: [], raisedAt: Date.now() - 60_000 };
  const judged = judgeGate({ db, workflowId: 'wf-base', repo, gate, graceMs: 0 });
  assert.equal(judged.stale, true);
  assert.match(judged.reasons[0], /lite \.starciwork holds only brand\//);
  assert.deepEqual(judged.waits, []);
  write(repo, 'hfs.json', JSON.stringify({ kind: 'app', edition: 'full' }));
  assert.equal(evaluateCondition(db, cond, { repo }).met, true);
  assert.match(judgeGate({ db, workflowId: 'wf-base', repo, gate, graceMs: 0 }).reasons[0], /exists/);
  assert.deepEqual(namedPaths('Wait for .starciwork/shell/index.yaml. Then .starciwork/brand/.'), ['.starciwork/shell/index.yaml', '.starciwork/brand']);
});

test('lite prompts use the brand direction without instructing a shell read', (t) => {
  const repo = app(t), packet = { op: 'brand.decide', brief: 'modules/ops/ops/brand.decide.yaml', context: { records: [], owned_paths: [] }, constraints: { model: 'm' } };
  const localeLine = () => buildOpPrompt({ skillRoot: ROOT, packet, repo }).split('\n').find(line => line.startsWith('product_locale:'));
  assert.match(localeLine(), /lite \.starciwork holds only brand\//);
  assert.doesNotMatch(localeLine(), /shell\/index\.yaml/);
  assert.match(buildOpPrompt({ skillRoot: ROOT, packet, repo }), /edition: lite.*Skip the brief.*reads, writes, steps and proofs.*brand\.decide uses brand\/\*\*/);
  write(repo, 'hfs.json', JSON.stringify({ kind: 'app', edition: 'full' }));
  assert.match(localeLine(), /shell\/index\.yaml verbatim/);
});
