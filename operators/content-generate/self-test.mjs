import assert from 'node:assert/strict';
import { validateInput } from './validate-input.mjs';
import { validateOutput } from './validate-output.mjs';

const hash = `sha256:${'a'.repeat(64)}`;
const otherHash = `sha256:${'c'.repeat(64)}`;
const sourceHead = 'b'.repeat(40);
const observedAt = '2026-09-02T00:00:00.000Z';
const contextRef = (ref, head = null) => ({ ref, fingerprint: hash, sourceHead: head, observedAt });

const validInput = {
  schemaVersion: 8,
  operatorId: 'content.generate',
  context: {
    curriculumRefs: [contextRef('curriculum://backend/transactions')],
    styleRefs: [contextRef('style://starci/editorial')],
    sourceRefs: [contextRef('source://starci-academy-content', sourceHead)],
    aiRuntime: {
      configRef: '.claude/config.yaml',
      fingerprint: hash,
      brief: { model: 'gpt-5.6-luna', count: 1, isolation: 'fresh', forkTurns: 'none' },
      production: { model: 'gpt-5.6-luna' },
      critique: { model: 'gpt-5.6-luna', count: 1, isolation: 'fresh', forkTurns: 'none' },
    },
    auditRefs: [],
  },
  input: {
    invocationId: 'invocation-idempotency-1',
    missionId: 'mission-content',
    project: {
      id: 'starci-academy',
      contentSourceRef: 'source://starci-academy-content',
      sourceHead,
      artifactRootRef: '.v8/artifacts/invocation-idempotency-1',
    },
    unit: {
      id: 'lesson-idempotency',
      mode: 'generate',
      objectiveRef: 'objective://backend/idempotent-writes',
      audienceRef: 'audience://junior-backend',
      existingUnitRef: null,
    },
    naturalLanguages: ['vi', 'en'],
    implementationLanguages: ['typescript', 'go'],
    stageModes: { image: 'required', code: 'required', e2e: 'required' },
    maxE2eIterations: 3,
    review: { round: 1, maxRounds: 3, minimumScore: 85 },
    targets: {
      briefTargetRef: 'content://lesson-idempotency/brief',
      articleTargets: [
        { language: 'vi', ref: 'content://lesson-idempotency/vi' },
        { language: 'en', ref: 'content://lesson-idempotency/en' },
      ],
      imageTargetRef: 'content://lesson-idempotency/diagram',
      promptTargetRef: 'content://lesson-idempotency/diagram-prompt',
      trackTargets: [
        { language: 'typescript', ref: 'content://lesson-idempotency/ts' },
        { language: 'go', ref: 'content://lesson-idempotency/go' },
      ],
      reviewTargetRef: 'content://lesson-idempotency/critique',
    },
    commands: [
      { language: 'typescript', command: 'npm run test:e2e' },
      { language: 'go', command: 'go test ./e2e/...' },
    ],
    resume: null,
  },
};

const briefRef = 'content://lesson-idempotency/brief';
const reviewRef = 'content://lesson-idempotency/critique';
const viRef = 'content://lesson-idempotency/vi';
const enRef = 'content://lesson-idempotency/en';
const imageRef = 'content://lesson-idempotency/diagram';
const promptRef = 'content://lesson-idempotency/diagram-prompt';
const tsRef = 'content://lesson-idempotency/ts';
const goRef = 'content://lesson-idempotency/go';
const tsAssertions = 'evidence://e2e/typescript-assertions';
const goAssertions = 'evidence://e2e/go-assertions';

const outcomeA = 'outcome://explain-retry-safety';
const outcomeB = 'outcome://implement-idempotency-key';
const claimA = 'claim://duplicate-request-same-effect';
const claimB = 'claim://key-scope-is-the-caller';

const evidenceRefs = ['curriculum://backend/transactions', 'evidence://build/typescript', 'evidence://review/round-1'];

const binding = {
  projectId: 'starci-academy',
  contentSourceRef: 'source://starci-academy-content',
  sourceHead,
  artifactRootRef: validInput.input.project.artifactRootRef,
  unitId: 'lesson-idempotency',
  mode: 'generate',
  naturalLanguages: ['vi', 'en'],
  implementationLanguages: ['typescript', 'go'],
  stageModes: { image: 'required', code: 'required', e2e: 'required' },
  minimumScore: 85,
  reviewRound: 1,
  curriculumFingerprint: hash,
  briefFingerprint: hash,
  inputFingerprint: hash,
  progressFingerprint: hash,
};

const execution = (executionRef, model) => ({ executionRef, model, isolation: 'fresh', forkTurns: 'none' });

const validGeneratedOutput = {
  schemaVersion: 8,
  operatorId: 'content.generate',
  output: {
    outcome: 'generated',
    receipt: {
      receiptType: 'content-generation-receipt',
      receiptId: 'receipt:lesson-idempotency',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'generated',
      binding,
      unit: {
        brief: {
          briefRef,
          fingerprint: hash,
          execution: execution('execution://teacher-brief', 'gpt-5.6-luna'),
          learnerInputRefs: ['prerequisite://http-methods'],
          learnerOutcomeRefs: [outcomeA, outcomeB],
          claimRefs: [claimA, claimB],
          exampleRefs: ['example://double-charge', 'example://key-collision'],
          dispositions: [
            {
              kind: 'remove',
              targetRef: 'section://old-retry-advice',
              statement: 'The old retry section contradicts the new key scope and is removed.',
            },
          ],
        },
        articles: [
          {
            language: 'vi',
            articleRef: viRef,
            coveredOutcomeRefs: [outcomeA, outcomeB],
            interviewQuestionCount: 6,
            execution: execution('execution://write-vi', 'gpt-5.6-luna'),
          },
          {
            language: 'en',
            articleRef: enRef,
            coveredOutcomeRefs: [outcomeA, outcomeB],
            interviewQuestionCount: 6,
            execution: execution('execution://write-en', 'gpt-5.6-luna'),
          },
        ],
        image: {
          imageRef,
          promptRef,
          generator: 'builtin-image-generator',
          claimRefs: [claimA],
          inspection: {
            legible: true,
            hierarchyReadable: true,
            claimFidelity: true,
            evidenceRef: 'evidence://image/inspection',
          },
        },
        tracks: [
          {
            language: 'typescript',
            sourceRef: tsRef,
            buildCommand: 'npm run build',
            exitCode: 0,
            evidenceRef: 'evidence://build/typescript',
          },
          {
            language: 'go',
            sourceRef: goRef,
            buildCommand: 'go build ./...',
            exitCode: 0,
            evidenceRef: 'evidence://build/go',
          },
        ],
        e2e: {
          contractFingerprintBefore: hash,
          contractFingerprintAfter: hash,
          iterations: 2,
          runs: [
            {
              language: 'typescript',
              command: 'npm run test:e2e',
              exitCode: 0,
              assertionsRef: tsAssertions,
            },
            { language: 'go', command: 'go test ./e2e/...', exitCode: 0, assertionsRef: goAssertions },
          ],
        },
        critique: {
          reviewRef,
          execution: execution('execution://independent-critique', 'gpt-5.6-luna'),
          verdict: 'approved',
          scores: {
            correctness: 92,
            pedagogy: 88,
            interviewValue: 87,
            language: 90,
            visualFidelity: 86,
            codeQuality: 89,
            e2eProof: 94,
          },
          findings: [
            {
              owningStage: 'write',
              severity: 'improvement',
              statement: 'The Vietnamese edition could name the failure case earlier.',
              evidenceRef: 'evidence://review/vi-paragraph-3',
            },
          ],
          receivedArtifactRefs: [viRef, enRef, imageRef, promptRef, tsRef, goRef, tsAssertions, goAssertions],
          producerRationaleReceived: false,
        },
        approvedArtifactRefs: [viRef, enRef, imageRef, tsRef, goRef],
      },
      findings: [
        {
          code: 'DISPOSITION_APPLIED',
          stage: 'brief',
          ref: 'section://old-retry-advice',
          statement: 'The superseded retry section was removed as the brief directed.',
        },
      ],
      evidenceRefs,
      failure: null,
      resume: null,
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [briefRef, viRef, enRef, imageRef, promptRef, tsRef, goRef, reviewRef],
    handoff: null,
  },
};

const validBlockedOutput = {
  schemaVersion: 8,
  operatorId: 'content.generate',
  output: {
    outcome: 'blocked',
    receipt: {
      receiptType: 'content-generation-receipt',
      receiptId: 'receipt:lesson-idempotency-blocked',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'blocked',
      binding,
      unit: null,
      findings: [],
      evidenceRefs,
      failure: {
        code: 'E2E_FAILED',
        stage: 'e2e',
        message: 'The Go track still returns a duplicate effect on the second request after three repair iterations.',
        refs: [goRef],
        missingRefs: ['evidence://e2e/go-passing-run'],
        retryable: true,
        owningDomain: 'content',
      },
      resume: {
        resumeToken: 'resume-lesson-idempotency-1',
        requiredDelta: ['Repair the Go idempotency key scope, then rerun the executable check.'],
      },
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [briefRef],
    handoff: null,
  },
};

assert.deepEqual(validateInput(validInput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validGeneratedOutput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validBlockedOutput), { valid: true, errors: [] });

// A declared edition with no destination is a language the writing stage cannot deliver.
const missingArticleTarget = structuredClone(validInput);
missingArticleTarget.input.targets.articleTargets.pop();
assert.equal(validateInput(missingArticleTarget).valid, false);

// Implementation tracks cannot be declared for a disabled code stage.
const disabledCodeWithTracks = structuredClone(validInput);
disabledCodeWithTracks.input.stageModes.code = 'disabled';
assert.equal(validateInput(disabledCodeWithTracks).valid, false);

// An executable check cannot be required for code that is never written.
const e2eWithoutCode = structuredClone(validInput);
e2eWithoutCode.input.stageModes.code = 'disabled';
e2eWithoutCode.input.implementationLanguages = [];
e2eWithoutCode.input.targets.trackTargets = [];
const e2eWithoutCodeResult = validateInput(e2eWithoutCode);
assert.equal(e2eWithoutCodeResult.valid, false);
assert.ok(e2eWithoutCodeResult.errors.some((error) => error.includes('never written')));

// An image needs the prompt that states its intent, not just a place to put the picture.
const imageWithoutPrompt = structuredClone(validInput);
imageWithoutPrompt.input.targets.promptTargetRef = null;
assert.equal(validateInput(imageWithoutPrompt).valid, false);

// A refactor must name the unit it refactors.
const refactorWithoutUnit = structuredClone(validInput);
refactorWithoutUnit.input.unit.mode = 'refactor';
assert.equal(validateInput(refactorWithoutUnit).valid, false);

// The critique cannot be written over the brief; producing intent and judgement stay separate.
const sharedTarget = structuredClone(validInput);
sharedTarget.input.targets.reviewTargetRef = sharedTarget.input.targets.briefTargetRef;
assert.equal(validateInput(sharedTarget).valid, false);

// The brief constrains the writing: an edition cannot claim an outcome the brief never published.
const inventedOutcome = structuredClone(validGeneratedOutput);
inventedOutcome.output.receipt.unit.articles[0].coveredOutcomeRefs.push('outcome://invented');
const inventedResult = validateOutput(inventedOutcome);
assert.equal(inventedResult.valid, false);
assert.ok(inventedResult.errors.some((error) => error.includes('never published')));

// Nor can an edition ship while a published outcome stays uncovered.
const uncoveredOutcome = structuredClone(validGeneratedOutput);
uncoveredOutcome.output.receipt.unit.articles[1].coveredOutcomeRefs = [outcomeA];
const uncoveredResult = validateOutput(uncoveredOutcome);
assert.equal(uncoveredResult.valid, false);
assert.ok(uncoveredResult.errors.some((error) => error.includes('uncovered')));

// Generated code in a lesson must actually run.
const brokenBuild = structuredClone(validGeneratedOutput);
brokenBuild.output.receipt.unit.tracks[1].exitCode = 2;
const brokenBuildResult = validateOutput(brokenBuild);
assert.equal(brokenBuildResult.valid, false);
assert.ok(brokenBuildResult.errors.some((error) => error.includes('working code')));

// So must the executable check, and every declared track must be exercised by it.
const untestedTrack = structuredClone(validGeneratedOutput);
untestedTrack.output.receipt.unit.e2e.runs.pop();
assert.equal(validateOutput(untestedTrack).valid, false);

// The repair loop may fix the implementation; it may never move the contract it is measured by.
const weakenedContract = structuredClone(validGeneratedOutput);
weakenedContract.output.receipt.unit.e2e.contractFingerprintAfter = otherHash;
const weakenedResult = validateOutput(weakenedContract);
assert.equal(weakenedResult.valid, false);
assert.ok(weakenedResult.errors.some((error) => error.includes('measures nothing')));

// An image carries the brief's claims; anything else is decoration added afterwards.
const inventedClaim = structuredClone(validGeneratedOutput);
inventedClaim.output.receipt.unit.image.claimRefs = ['claim://invented'];
assert.equal(validateOutput(inventedClaim).valid, false);

// A unit reviewed by its own producer has not been reviewed.
const selfReview = structuredClone(validGeneratedOutput);
selfReview.output.receipt.unit.critique.execution.executionRef = 'execution://teacher-brief';
const selfReviewResult = validateOutput(selfReview);
assert.equal(selfReviewResult.valid, false);
assert.ok(selfReviewResult.errors.some((error) => error.includes('produced the unit')));

// Nor has one whose reviewer inherited the producing conversation.
const inheritedReview = structuredClone(validGeneratedOutput);
inheritedReview.output.receipt.unit.critique.execution.forkTurns = 'inherited';
assert.equal(validateOutput(inheritedReview).valid, false);

// The reviewer must actually receive every artifact, or something shipped unlooked at.
const hiddenArtifact = structuredClone(validGeneratedOutput);
hiddenArtifact.output.receipt.unit.critique.receivedArtifactRefs =
  hiddenArtifact.output.receipt.unit.critique.receivedArtifactRefs.filter((ref) => ref !== imageRef);
assert.equal(validateOutput(hiddenArtifact).valid, false);

// Approval below the published minimum is not approval.
const lowScoreApproval = structuredClone(validGeneratedOutput);
lowScoreApproval.output.receipt.unit.critique.scores.pedagogy = 71;
const lowScoreResult = validateOutput(lowScoreApproval);
assert.equal(lowScoreResult.valid, false);
assert.ok(lowScoreResult.errors.some((error) => error.includes('below 85')));

// Nor is approval while an error finding remains open.
const openErrorApproval = structuredClone(validGeneratedOutput);
openErrorApproval.output.receipt.unit.critique.findings[0].severity = 'error';
assert.equal(validateOutput(openErrorApproval).valid, false);

// A unit cannot be generated while the independent critique demands a revision.
const revisionShipped = structuredClone(validGeneratedOutput);
revisionShipped.output.receipt.unit.critique.verdict = 'revision-required';
revisionShipped.output.receipt.unit.critique.findings[0].severity = 'error';
const revisionResult = validateOutput(revisionShipped);
assert.equal(revisionResult.valid, false);
assert.ok(revisionResult.errors.some((error) => error.includes('demands a revision')));

// A disabled stage must be recorded, or a later reader cannot tell it from an omission.
const unrecordedDisabledStage = structuredClone(validBlockedOutput);
unrecordedDisabledStage.output.receipt.binding.stageModes.image = 'disabled';
const unrecordedResult = validateOutput(unrecordedDisabledStage);
assert.equal(unrecordedResult.valid, false);
assert.ok(unrecordedResult.errors.some((error) => error.includes('STAGE_DISABLED')));

// A blocked receipt never carries a unit.
const blockedWithUnit = structuredClone(validBlockedOutput);
blockedWithUnit.output.receipt.unit = validGeneratedOutput.output.receipt.unit;
assert.equal(validateOutput(blockedWithUnit).valid, false);

console.log('content.generate self-test passed');
