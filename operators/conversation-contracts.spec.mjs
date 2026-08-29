import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput as validateQueryInput } from './source/conversation-query/validate-input.mjs';
import { validateOutput as validateQueryOutput } from './source/conversation-query/validate-output.mjs';
import { validateInput as validateRecordInput } from './source/conversation-record/validate-input.mjs';
import { validateOutput as validateRecordOutput } from './source/conversation-record/validate-output.mjs';

const hash = (character) => `sha256:${character.repeat(64)}`;
const identity = { provider: 'openai', conversationId: 'conversation-1', project: 'starci', role: 'backend' };

const queryInput = {
  schemaVersion: 7,
  operatorId: 'source/conversation-query',
  context: {
    policy: { revision: 'policy-1', returnRawBodies: false },
    index: { generation: 'generation-1', status: 'current', headsFingerprint: hash('a'), evidenceRef: 'evidence:index' },
    candidateHeads: [{
      identity,
      headRef: 'provenance:heads/conversation-1',
      headSha256: hash('b'),
      snapshotSha256: hash('c'),
      artifactRefs: ['artifact:delivery-1'],
      sourceRevision: 'commit-1',
      evidenceRef: 'evidence:head'
    }]
  },
  input: {
    identity,
    authorizedScope: { project: 'starci', role: 'backend', evidenceRef: 'evidence:scope' }
  }
};

const queryFound = {
  schemaVersion: 7,
  operatorId: 'source/conversation-query',
  output: {
    outcome: 'found',
    headRef: 'provenance:heads/conversation-1',
    headSha256: hash('b'),
    snapshotSha256: hash('c'),
    artifactRefs: ['artifact:delivery-1'],
    reason: 'current-match',
    evidenceRefs: ['evidence:index', 'evidence:scope', 'evidence:head']
  }
};

const recordInput = {
  schemaVersion: 7,
  operatorId: 'source/conversation-record',
  context: {
    policy: { policyVersion: 'policy-1', scannerVersion: 'scanner-1', evidenceRef: 'evidence:policy' },
    writeAuthority: { allowed: true, project: 'starci', role: 'backend', authorityRef: 'authority:provenance' },
    currentHead: null
  },
  input: {
    identity,
    snapshot: { ref: 'session://tasks/task-1/redacted-snapshot', sha256: hash('c'), redacted: true },
    redactionReceipt: {
      ref: 'session://tasks/task-1/redaction-receipt',
      policyVersion: 'policy-1',
      inputSha256: hash('d'),
      outputSha256: hash('c'),
      scannerVersion: 'scanner-1',
      prohibitedCategoriesPassed: true
    },
    artifactRefs: ['artifact:delivery-1'],
    sourceRevision: 'commit-1'
  }
};

const recordOutput = {
  schemaVersion: 7,
  operatorId: 'source/conversation-record',
  output: {
    outcome: 'recorded',
    headRef: 'provenance:heads/conversation-1',
    headSha256: hash('e'),
    writeApplied: true,
    reason: 'appended',
    evidenceRefs: ['evidence:policy', 'evidence:write']
  }
};

test('conversation query accepts one bounded identity and returns only current metadata', () => {
  assert.equal(validateQueryInput(queryInput).valid, true);
  assert.equal(validateQueryOutput(queryFound).valid, true);
  assert.equal(validateQueryInput({ ...queryInput, stage: 'source.conversation.query' }).valid, false);

  const broadened = structuredClone(queryInput);
  broadened.context.candidateHeads[0].identity = {
    ...broadened.context.candidateHeads[0].identity,
    conversationId: 'another-conversation'
  };
  assert.equal(validateQueryInput(broadened).valid, false);

  const leakedEmpty = structuredClone(queryFound);
  Object.assign(leakedEmpty.output, {
    outcome: 'empty', reason: 'no-match', headRef: null, headSha256: null, snapshotSha256: null
  });
  assert.equal(validateQueryOutput(leakedEmpty).valid, false, 'empty cannot expose artifact refs');
});

test('conversation record binds redaction proof and exposes compare-and-set truth', () => {
  assert.equal(validateRecordInput(recordInput).valid, true);
  assert.equal(validateRecordOutput(recordOutput).valid, true);
  assert.equal(validateRecordInput({ ...recordInput, cleanup: {} }).valid, false);

  const wrongReceipt = structuredClone(recordInput);
  wrongReceipt.input.redactionReceipt.outputSha256 = hash('f');
  assert.equal(validateRecordInput(wrongReceipt).valid, false);

  const falseWrite = structuredClone(recordOutput);
  falseWrite.output.writeApplied = false;
  assert.equal(validateRecordOutput(falseWrite).valid, false);

  const conflicting = structuredClone(recordOutput);
  Object.assign(conflicting.output, { outcome: 'conflict', reason: 'identity-conflict', writeApplied: false });
  assert.equal(validateRecordOutput(conflicting).valid, false, 'conflict cannot claim a published head');
});
