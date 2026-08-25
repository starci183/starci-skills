import assert from 'node:assert/strict';
import test from 'node:test';
import { validateInput } from './platform/reference-reindex/validate-input.mjs';
import { validateOutput } from './platform/reference-reindex/validate-output.mjs';

const hash = `sha256:${'a'.repeat(64)}`;
const revision = 'b'.repeat(40);
const task = 'reference-test';
const ref = (name) => `session://tasks/${task}/${name}`;
const file = { path: 'src/example.ts', blobSha256: hash, bytes: 100, recordCount: 1 };

function input() {
  const artifacts = ['mcp', 'routes', 'policy'].map((name) => ({ ref: ref(name), revision: hash, loadMode: 'session-exact' }));
  return {
    schemaVersion: 6, runId: task, stage: 'platform.mcp.index', status: 'ready', facts: ['platform-mcp-config-ready'],
    payload: {
      provided: { mcpConfigReceiptRef: ref('mcp'), portableRoutesRef: ref('routes'), driftPolicyRef: ref('policy') },
      loads: {
        artifacts,
        references: [{ id: 'demo-fe', project: 'demo', role: 'fe', path: '.worktrees/references/demo-fe', repository: 'https://example.test/demo.git', branch: 'main', targetRevision: revision, checkoutRevision: revision, dirty: false, historyComparable: true, currentFiles: [file], loadMode: 'metadata-first' }],
        index: { contractFingerprint: hash, partitions: [], loadMode: 'metadata-only' },
        policy: { id: 'reference-drift-balanced-v1', revision: hash, strategy: 'adaptive-budget', manualFull: false, incrementalCostCeiling: 0.65, maxAffectedRecordRatio: 0.35, maxDeleteRatio: 0.25, loadMode: 'session-exact' },
        runtime: { stateRoot: '.workspaces/local/state/reference-context', referenceRoot: '.worktrees/references', pythonVersion: '3.12.1', qdrantEdgeVersion: '0.8.0', mcpSdkVersion: '2.0.0', caddyVersion: '2.11.4', qdrantHandleRef: ref('qdrant'), mcpHandleRef: ref('mcp-runtime'), caddyHandleRef: ref('caddy'), codexUrl: 'http://127.0.0.1:8021/mcp', queryMode: 'full-text-and-path', embeddingMode: 'disabled', loadMode: 'metadata-only' },
        orchestration: { mode: 'economical', profileRef: 'orchestration/modes/economical.json', providerRef: 'orchestration/providers/openai.json' }
      },
      session: { taskId: task, inputRef: ref('input'), outputRef: ref('output'), scratchPrefix: ref('scratch'), retention: 'until-skill-terminal' }
    }
  };
}

const metrics = (overrides = {}) => ({ addedFiles: 0, modifiedFiles: 0, deletedFiles: 0, unchangedFiles: 1, changedBytes: 0, totalBytes: 100, affectedRecords: 0, totalRecords: 1, incrementalCost: 0, fullCost: 1124, deleteRatio: 0, affectedRecordRatio: 0, ...overrides });

function output(reference) {
  return {
    schemaVersion: 6, runId: task, stage: 'platform.mcp.publish', status: 'ready', facts: ['platform-reference-index-ready'],
    payload: {
      decision: 'ready',
      state: { operator: 'platform/reference-reindex', status: 'completed', code: 'platform-reference-index-ready', retryable: false, emits: { stage: 'platform.mcp.publish', status: 'ready', factsAdd: ['platform-reference-index-ready'] } },
      produced: {
        policy: { id: 'reference-drift-balanced-v1', revision: hash, strategy: 'adaptive-budget', manualFull: false, incrementalCostCeiling: 0.65, maxAffectedRecordRatio: 0.35, maxDeleteRatio: 0.25 },
        runtime: { stateRoot: '.workspaces/local/state/reference-context', codexUrl: 'http://127.0.0.1:8021/mcp', clientAction: 'merged', protocolProved: true, queryProved: true },
        references: [reference], durableWrites: ['.workspaces/local/state/reference-context/partitions/demo-fe']
      },
      context: { used: [{ kind: 'reference-worktree', ref: '.worktrees/references/demo-fe', revision }] },
      cleanup: { scratchRefs: [ref('scratch/drift')], retention: 'until-skill-terminal', purgeAt: 'skill-terminal' },
      evidenceRefs: [ref('proof')], findings: []
    }
  };
}

test('input binds portable direct-child reference and adaptive policy', () => {
  assert.deepEqual(validateInput(input()), { valid: true, errors: [] });
  const invalid = input();
  invalid.payload.loads.references[0].path = '.worktrees/references/other';
  assert.equal(validateInput(invalid).valid, false);
});

test('noop requires zero eligible drift', () => {
  const candidate = output({ id: 'demo-fe', beforeRevision: revision, afterRevision: revision, action: 'noop', reason: 'no-eligible-drift', generation: 'generation-1', metrics: metrics() });
  assert.deepEqual(validateOutput(candidate), { valid: true, errors: [] });
  candidate.payload.produced.references[0].metrics.modifiedFiles = 1;
  assert.equal(validateOutput(candidate).valid, false);
});

test('incremental is rejected when an adaptive budget is crossed', () => {
  const candidate = output({ id: 'demo-fe', beforeRevision: revision, afterRevision: 'c'.repeat(40), action: 'incremental', reason: 'compatible-delta', generation: 'generation-2', metrics: metrics({ modifiedFiles: 1, unchangedFiles: 9, changedBytes: 10, affectedRecords: 1, totalRecords: 10, incrementalCost: 100, fullCost: 1000, affectedRecordRatio: 0.1 }) });
  assert.equal(validateOutput(candidate).valid, true);
  candidate.payload.produced.references[0].metrics.affectedRecordRatio = 0.5;
  assert.equal(validateOutput(candidate).valid, false);
});

test('full action records the exact crossed budget', () => {
  const candidate = output({ id: 'demo-fe', beforeRevision: revision, afterRevision: 'c'.repeat(40), action: 'full', reason: 'incremental-cost-crossed', generation: 'generation-3', metrics: metrics({ modifiedFiles: 1, changedBytes: 90, affectedRecords: 1, incrementalCost: 700, fullCost: 1000, affectedRecordRatio: 0.1 }) });
  assert.equal(validateOutput(candidate).valid, true);
});
