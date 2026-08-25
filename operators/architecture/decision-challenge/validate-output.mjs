import { runValidatorCli, validatorFor } from '../../validation.mjs';

const schemaUrl = new URL('./output.schema.json', import.meta.url);
const routes = {
  "ready": {
    "stage": "architecture.decision.handoff",
    "status": "ready",
    "facts": ["architecture-challenge-ready", "architecture-visual-preview-ready"],
    "state": "completed",
    "code": "architecture-decision-challenge-ready"
  },
  "revise": {
    "stage": "architecture.decision.alternatives",
    "status": "ready",
    "facts": ["architecture-feedback"],
    "state": "replan",
    "code": "architecture-decision-challenge-revise"
  },
  "blocked": {
    "stage": "architecture.blocked",
    "status": "blocked",
    "facts": ["architecture-decision-blocked"],
    "state": "blocked",
    "code": "architecture-decision-challenge-blocked"
  }
};

function semantic(value) {
  const errors = [];
  const route = routes[value.payload.decision];
  if (!route) return ['/payload/decision: undeclared decision'];
  if (value.stage !== route.stage || value.status !== route.status) errors.push('/stage: decision does not match emitted route');
  if (value.payload.state.status !== route.state || value.payload.state.code !== route.code) errors.push('/payload/state: status or code does not match decision');
  if (value.payload.state.emits.stage !== value.stage || value.payload.state.emits.status !== value.status) errors.push('/payload/state/emits: must match root route');
  for (const fact of route.facts) {
    if (!value.facts.includes(fact) || !value.payload.state.emits.factsAdd.includes(fact)) errors.push(`/facts: missing emitted fact ${fact}`);
  }
  const blocked = value.payload.state.status === 'blocked';
  if (!blocked && value.payload.produced.challengeReceiptRef === null) errors.push('/payload/produced/challengeReceiptRef: successful output requires a session artifact');
  const challenge = value.payload.challengeSummary;
  if (challenge.verdict !== value.payload.decision) errors.push('/payload/challengeSummary/verdict: must match payload.decision');
  if (value.payload.decision === 'ready' && challenge.unresolvedCriticalIds.length !== 0) errors.push('/payload/challengeSummary/unresolvedCriticalIds: ready architecture cannot retain a critical challenge');
  if (value.payload.decision !== 'ready' && challenge.unresolvedCriticalIds.length === 0) errors.push('/payload/challengeSummary/unresolvedCriticalIds: revise or blocked requires an explicit critical challenge');
  const preview = value.payload.reviewPreview;
  if (value.payload.decision === 'ready') {
    if (!preview) errors.push('/payload/reviewPreview: ready architecture review requires a visualize preview');
    else {
      const expectedScenarios = ['normal', 'retry', 'concurrency', 'outage', 'rollback'];
      const sameStrings = (left, right) => [...left].sort().join('\0') === [...right].sort().join('\0');
      if (!sameStrings(preview.scenarioIds, expectedScenarios)) errors.push('/payload/reviewPreview/scenarioIds: must cover normal, retry, concurrency, outage, and rollback exactly');
      if (!preview.optionIds.includes(preview.recommendedOptionId)) errors.push('/payload/reviewPreview/recommendedOptionId: must identify one rendered option');
      if (value.payload.produced.reviewArtifactRef !== preview.artifactRef) errors.push('/payload/produced/reviewArtifactRef: must equal reviewPreview.artifactRef');
      if (!value.payload.evidenceRefs.includes(preview.artifactRef)) errors.push('/payload/reviewPreview/artifactRef: must be registered in evidenceRefs');
      if (!value.payload.cleanup.scratchRefs.includes(preview.artifactRef)) errors.push('/payload/reviewPreview/artifactRef: must be registered for terminal purge');
      const commandIds = preview.approvalCommands.map((item) => item.decisionId);
      if (!sameStrings(commandIds, preview.optionIds)) errors.push('/payload/reviewPreview/approvalCommands: must cover every rendered option exactly once');
      const expectedRejected = preview.optionIds.filter((id) => id !== preview.recommendedOptionId);
      if (!sameStrings(challenge.rejectedOptionIds, expectedRejected)) errors.push('/payload/challengeSummary/rejectedOptionIds: must identify every non-recommended rendered option');
      const revision = preview.optionSetSha256.slice('sha256:'.length);
      for (const item of preview.approvalCommands) {
        if (item.command !== `OK ARCHITECTURE ${item.decisionId}@${revision}`) errors.push(`/payload/reviewPreview/approvalCommands: invalid exact approval command for ${item.decisionId}`);
      }
    }
  } else if (preview || value.payload.produced.reviewArtifactRef) {
    errors.push('/payload/reviewPreview: only a ready architecture decision may claim an approval preview');
  }
  if (value.payload.produced.durableWrites.length !== 0) errors.push('/payload/produced/durableWrites: read-only operator cannot report durable writes');
  if (value.payload.cleanup.retention !== 'until-skill-terminal' || value.payload.cleanup.purgeAt !== 'skill-terminal') errors.push('/payload/cleanup: terminal purge is mandatory');
  return errors;
}

export const validateOutput = validatorFor(schemaUrl, semantic);

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\\\', '/')}`).href) {
  await runValidatorCli(validateOutput, 'usage: node validate-output.mjs <output.json>');
}
