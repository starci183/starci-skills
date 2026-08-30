import assert from 'node:assert/strict';
import test from 'node:test';
import { fingerprintGrammarPattern, validateGrammarProposal } from '../runtime/contracts/grammar-proposal.mjs';

const proposal = () => {
  const value = {
    schemaVersion: 1,
    contractVersion: '7.4.0',
    proposalId: 'proposal://chat-workspace',
    patternName: 'ChatWorkspace',
    scope: 'grammar',
    anatomy: ['history?', 'header', 'transcript', 'composer', 'support?'],
    consumerRefs: ['consumer://assistant-drawer', 'consumer://chat-page'],
    platformInvariantRefs: [],
    alternativeRefs: ['alternative://application-only', 'alternative://conversation-only'],
    migrationRefs: ['migration://chat-consumers'],
    status: 'proposal',
    patternFingerprint: '',
    approval: null,
  };
  value.patternFingerprint = fingerprintGrammarPattern(value);
  return value;
};

test('Grammar proposal remains non-publishable without approval', () => {
  const value = proposal();
  assert.deepEqual(validateGrammarProposal(value), { valid: true, errors: [] });
  value.status = 'approved';
  assert.match(validateGrammarProposal(value).errors.join('\n'), /teacher authority/);
});

test('Grammar approval binds teacher authority to the exact anatomy', () => {
  const value = proposal();
  value.status = 'approved';
  value.approval = { authorityRef: 'request:current#ChatWorkspace', decision: 'approve', patternFingerprint: value.patternFingerprint };
  assert.deepEqual(validateGrammarProposal(value), { valid: true, errors: [] });
  value.anatomy.push('unapproved-slot');
  assert.match(validateGrammarProposal(value).errors.join('\n'), /fingerprint/);
});

test('Grammar proposal needs two consumers or one platform invariant', () => {
  const value = proposal();
  value.consumerRefs = ['consumer://chat-page'];
  value.patternFingerprint = fingerprintGrammarPattern(value);
  assert.match(validateGrammarProposal(value).errors.join('\n'), /two independent consumers/);
});
