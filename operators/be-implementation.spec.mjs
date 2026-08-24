import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateInput } from './be/implementation/validate-input.mjs';
import { validateOutput } from './be/implementation/validate-output.mjs';
import { validatorFor } from './validation.mjs';

const hash = (character) => `sha256:${character.repeat(64)}`;
const session = 'session://tasks/task-1/';

function validInput() {
  return {
    schemaVersion: 6,
    runId: 'run-1',
    stage: 'architecture.boundary.review',
    status: 'approved',
    facts: ['backend-boundary-approved'],
    payload: {
      provided: {
        approvedBoundaryRef: `${session}boundary`,
        approvalReceiptRef: `${session}approval`,
        businessHeadRef: `${session}business`,
        baselineCommitRef: 'git:abcdef1'
      },
      loads: {
        business: { ref: `${session}business`, authorityPath: '.worktrees/starci-academy/businesses/create-vps/model.json', revision: hash('a') },
        boundary: { ref: `${session}boundary`, revision: hash('b') },
        knowledge: [{ id: 'be.implementation', generation: 'generation-1', contentSha256: hash('c'), loadMode: 'qdrant-exact' }],
        source: {
          loadMode: 'exact-files',
          repositoryContext: false,
          targetFiles: [{ path: 'src/vps/vps.service.ts', beforeSha256: hash('d'), allowedChanges: ['implement create VPS'] }]
        },
        orchestration: {
          mode: 'balanced',
          profileRef: 'orchestration/modes/balanced.json',
          providerRef: 'orchestration/providers/codex.json'
        }
      },
      session: {
        taskId: 'task-1',
        inputRef: `${session}input`,
        outputRef: `${session}output`,
        scratchPrefix: `${session}scratch`,
        retention: 'until-skill-terminal'
      }
    }
  };
}

function validReadyOutput() {
  return {
    schemaVersion: 6,
    runId: 'run-1',
    stage: 'quality.format',
    status: 'ready',
    facts: ['backend-source-written'],
    payload: {
      decision: 'ready',
      state: {
        operator: 'be/implementation',
        status: 'completed',
        code: 'implementation-complete',
        retryable: false,
        emits: { stage: 'quality.format', status: 'ready', factsAdd: ['backend-source-written'] }
      },
      produced: {
        changeReceiptRef: `${session}change-receipt`,
        mutations: [{ path: 'src/vps/vps.service.ts', beforeSha256: hash('d'), afterSha256: hash('e') }]
      },
      context: { used: [{ kind: 'worktree-business', ref: `${session}business`, revision: hash('a') }] },
      cleanup: { scratchRefs: [`${session}scratch/source-checks/worker-1`], retention: 'until-skill-terminal', purgeAt: 'skill-terminal' },
      evidenceRefs: [`${session}evidence/source`],
      findings: []
    }
  };
}

test('accepts the closed session-only input and explicit ready state', () => {
  assert.deepEqual(validateInput(validInput()), { valid: true, errors: [] });
  assert.deepEqual(validateOutput(validReadyOutput()), { valid: true, errors: [] });
});

test('refuses repository source context and session references from another task', () => {
  const sourceContext = validInput();
  sourceContext.payload.loads.source.repositoryContext = true;
  assert.equal(validateInput(sourceContext).valid, false);
  const foreignSession = validInput();
  foreignSession.payload.provided.businessHeadRef = 'session://tasks/task-2/business';
  foreignSession.payload.loads.business.ref = foreignSession.payload.provided.businessHeadRef;
  assert.equal(validateInput(foreignSession).valid, false);
});

test('requires project-scoped business authority', () => {
  const legacyAuthority = validInput();
  legacyAuthority.payload.loads.business.authorityPath = '.worktrees/business/create-vps/model.json';
  assert.equal(validateInput(legacyAuthority).valid, false);
});

test('refuses non-ready state that claims source mutations', () => {
  const output = validReadyOutput();
  output.stage = 'architecture.boundary';
  output.payload.decision = 'source-drift';
  output.payload.state = {
    operator: 'be/implementation', status: 'replan', code: 'source-revision-drift', retryable: true,
    emits: { stage: 'architecture.boundary', status: 'ready', factsAdd: ['backend-boundary-feedback', 'source-drift'] }
  };
  output.facts = ['backend-boundary-feedback', 'source-drift'];
  assert.equal(validateOutput(output).valid, false);
});

test('orchestration modes and provider mappings are closed and consistent', () => {
  const modeValidator = validatorFor(new URL('../orchestration/mode.schema.json', import.meta.url));
  const providerValidator = validatorFor(new URL('../orchestration/provider.schema.json', import.meta.url));
  const modes = Object.fromEntries(['economical', 'balanced', 'parallel'].map((name) => {
    const value = JSON.parse(readFileSync(new URL(`../orchestration/modes/${name}.json`, import.meta.url), 'utf8'));
    assert.equal(modeValidator(value).valid, true);
    return [name, value];
  }));
  for (const provider of ['codex', 'claude']) {
    const value = JSON.parse(readFileSync(new URL(`../orchestration/providers/${provider}.json`, import.meta.url), 'utf8'));
    assert.equal(providerValidator(value).valid, true);
    for (const [mode, mapping] of Object.entries(value.modeMappings)) assert.ok(mapping.maxWorkers <= modes[mode].maxWorkers);
  }
});
