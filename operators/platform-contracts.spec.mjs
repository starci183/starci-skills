import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput as validatePlanInput } from './platform/tunnel-plan/validate-input.mjs';
import { validateOutput as validatePlanOutput } from './platform/tunnel-plan/validate-output.mjs';
import { validateInput as validateApplyInput } from './platform/tunnel-apply/validate-input.mjs';
import { validateOutput as validateApplyOutput } from './platform/tunnel-apply/validate-output.mjs';
import { validateInput as validateSonarInput } from './platform/sonar-service-reconcile/validate-input.mjs';
import { validateOutput as validateSonarOutput } from './platform/sonar-service-reconcile/validate-output.mjs';
import { validateInput as validateObservabilityInput } from './platform/observability-reconcile/validate-input.mjs';
import { validateOutput as validateObservabilityOutput } from './platform/observability-reconcile/validate-output.mjs';

const hash = (character) => `sha256:${character.repeat(64)}`;
const evidence = ['evidence:authority', 'evidence:observed'];

const tunnelPlanInput = {
  schemaVersion: 7,
  operatorId: 'platform/tunnel-plan',
  context: {
    authority: { accountId: 'account-1', zoneId: 'zone-1', owner: 'starci', routeRevision: 'route-1', credentialCustodyRef: 'custody:cloudflare', evidenceRef: evidence[0] },
    observedState: { tunnel: null, dns: null, route: null, evidenceRefs: [evidence[1]] }
  },
  input: { requestedIngress: { tunnelId: 'tunnel-1', hostname: 'api.example.com', origin: 'http://backend:3000', protocol: 'https', proxied: true } }
};

const tunnelPlanOutput = {
  schemaVersion: 7,
  operatorId: 'platform/tunnel-plan',
  output: { outcome: 'ready', planRef: 'session://tasks/task-1/tunnel-plan', planSha256: hash('a'), effects: ['create-tunnel', 'update-tunnel-route', 'upsert-proxied-dns'], conflicts: [], evidenceRefs: evidence }
};

const tunnelApplyInput = {
  schemaVersion: 7,
  operatorId: 'platform/tunnel-apply',
  context: {
    approvedPlan: { ref: 'session://tasks/task-1/tunnel-plan', sha256: hash('a'), accountId: 'account-1', zoneId: 'zone-1', tunnelId: 'tunnel-1', hostname: 'api.example.com', origin: 'http://backend:3000', protocol: 'https', effects: ['update-tunnel-route', 'upsert-proxied-dns'] },
    approval: { ref: 'approval:tunnel-1', planSha256: hash('a'), allowedEffects: ['update-tunnel-route', 'upsert-proxied-dns'], evidenceRef: evidence[0] },
    credentialCapability: { handleRef: 'handle:cloudflare', capabilities: ['tunnel:write', 'dns:write'], custodyEvidenceRef: 'evidence:custody' },
    observedState: { resourceFingerprint: hash('b'), evidenceRefs: [evidence[1]] }
  },
  input: { execution: { expectedPlanSha256: hash('a'), helperRef: 'scripts/cloudflare-tunnel.mjs', publicProbeUrl: 'https://api.example.com/health' } }
};

const tunnelChecks = ['dns-target', 'tunnel-route', 'tls', 'public-https'].map((name) => ({ name, status: 'passed', evidenceRef: `evidence:${name}` }));
const tunnelApplyOutput = {
  schemaVersion: 7,
  operatorId: 'platform/tunnel-apply',
  output: { outcome: 'proved', receiptRef: 'session://tasks/task-1/tunnel-proof', mutations: [], checks: tunnelChecks, reason: null, evidenceRefs: evidence }
};

const sonarEffects = ['create-project', 'assign-profile', 'assign-gate', 'enforce-setting'];
const sonarInput = {
  schemaVersion: 7,
  operatorId: 'platform/sonar-service-reconcile',
  context: {
    authority: { approvalRef: 'approval:sonar', planSha256: hash('c'), allowedEffects: sonarEffects, evidenceRef: evidence[0] },
    credentialCapability: { handleRef: 'handle:sonar', capability: 'sonar:project-admin', custodyEvidenceRef: 'evidence:custody' },
    observedState: { serviceAvailable: true, providerFingerprint: hash('d'), projects: [], evidenceRefs: [evidence[1]] }
  },
  input: {
    desiredState: {
      planSha256: hash('c'), serviceRef: 'sonar:service', effects: sonarEffects,
      projects: [{ projectKey: 'starci:backend', sourceRevision: 'commit-1', profileKey: 'profile-1', gateKey: 'gate-1', enforcementActive: true }]
    }
  }
};

const sonarKinds = ['service-available', 'project-exists', 'source-revision', 'profile-assigned', 'gate-assigned', 'enforcement-active'];
const sonarOutput = {
  schemaVersion: 7,
  operatorId: 'platform/sonar-service-reconcile',
  output: {
    outcome: 'proved', receiptRef: 'session://tasks/task-1/sonar-proof', mutations: [], reason: null, evidenceRefs: evidence,
    checks: sonarKinds.map((kind) => ({ kind, resourceRef: kind === 'service-available' ? 'sonar:service' : 'sonar:project/starci-backend', status: 'passed', evidenceRef: `evidence:${kind}` }))
  }
};

const observabilityEffects = ['update-config', 'restart-service', 'upsert-dashboard', 'update-remote-write'];
const observabilityResources = ['target:backend', 'dashboard:platform', 'remote-write:primary'];
const observabilityInput = {
  schemaVersion: 7,
  operatorId: 'platform/observability-reconcile',
  context: {
    authority: { approvalRef: 'approval:observability', planSha256: hash('e'), writableResourceRefs: observabilityResources, allowedEffects: observabilityEffects, evidenceRef: evidence[0] },
    credentialCapability: { handleRef: 'handle:remote-write', destinationRef: 'remote-write:primary', capability: 'metrics:remote-write', custodyEvidenceRef: 'evidence:custody' },
    observedState: { configurationFingerprint: hash('f'), resourceRefs: observabilityResources, evidenceRefs: [evidence[1]] }
  },
  input: {
    desiredState: {
      planSha256: hash('e'), services: ['cadvisor', 'prometheus', 'grafana'], scrapeTargets: ['target:backend'], dashboardRefs: ['dashboard:platform'], remoteWriteDestinationRef: 'remote-write:primary', sensitiveDataPolicyRef: 'policy:metrics-redaction', effects: observabilityEffects
    }
  }
};

const observabilityChecks = ['service-health', 'target-boundary', 'label-boundary', 'remote-write-delivery', 'sample-ordering', 'retry-backoff', 'sensitive-data-filter'];
const observabilityOutput = {
  schemaVersion: 7,
  operatorId: 'platform/observability-reconcile',
  output: { outcome: 'proved', receiptRef: 'session://tasks/task-1/observability-proof', mutations: [], reason: null, evidenceRefs: evidence, checks: observabilityChecks.map((name) => ({ name, status: 'passed', evidenceRef: `evidence:${name}` })) }
};

test('tunnel plan stays read-only and cannot emit an applicable blocked plan', () => {
  assert.equal(validatePlanInput(tunnelPlanInput).valid, true);
  assert.equal(validatePlanOutput(tunnelPlanOutput).valid, true);
  assert.equal(validatePlanInput({ ...tunnelPlanInput, stage: 'platform.tunnel.plan' }).valid, false);

  const foreignOwner = structuredClone(tunnelPlanInput);
  foreignOwner.context.observedState.tunnel = { tunnelId: 'tunnel-1', owner: 'another-owner', revision: 'revision-1' };
  assert.equal(validatePlanInput(foreignOwner).valid, false);

  const blockedWithPlan = structuredClone(tunnelPlanOutput);
  Object.assign(blockedWithPlan.output, { outcome: 'blocked', effects: [], conflicts: ['owner conflict'] });
  assert.equal(validatePlanOutput(blockedWithPlan).valid, false);
});

test('tunnel apply binds plan, approval, capabilities, and all public-route checks', () => {
  assert.equal(validateApplyInput(tunnelApplyInput).valid, true);
  assert.equal(validateApplyOutput(tunnelApplyOutput).valid, true);

  const missingCapability = structuredClone(tunnelApplyInput);
  missingCapability.context.credentialCapability.capabilities = ['dns:write'];
  assert.equal(validateApplyInput(missingCapability).valid, false);

  const failedProof = structuredClone(tunnelApplyOutput);
  failedProof.output.checks[0].status = 'failed';
  assert.equal(validateApplyOutput(failedProof).valid, false);
});

test('Sonar reconcile requires exact approval and every association postcondition kind', () => {
  assert.equal(validateSonarInput(sonarInput).valid, true);
  assert.equal(validateSonarOutput(sonarOutput).valid, true);

  const broadApproval = structuredClone(sonarInput);
  broadApproval.context.authority.allowedEffects = ['create-project'];
  assert.equal(validateSonarInput(broadApproval).valid, false);

  const missingGateProof = structuredClone(sonarOutput);
  missingGateProof.output.checks = missingGateProof.output.checks.filter(({ kind }) => kind !== 'gate-assigned');
  assert.equal(validateSonarOutput(missingGateProof).valid, false);
});

test('observability reconcile proves delivery, ordering, retry, and filtering separately', () => {
  assert.equal(validateObservabilityInput(observabilityInput).valid, true);
  assert.equal(validateObservabilityOutput(observabilityOutput).valid, true);

  const wrongDestination = structuredClone(observabilityInput);
  wrongDestination.context.credentialCapability.destinationRef = 'remote-write:other';
  assert.equal(validateObservabilityInput(wrongDestination).valid, false);

  const missingOrdering = structuredClone(observabilityOutput);
  missingOrdering.output.checks = missingOrdering.output.checks.filter(({ name }) => name !== 'sample-ordering');
  assert.equal(validateObservabilityOutput(missingOrdering).valid, false);
});
