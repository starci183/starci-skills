import assert from 'node:assert/strict';
import { validateInput } from './validate-input.mjs';
import { validateOutput } from './validate-output.mjs';

const hash = `sha256:${'a'.repeat(64)}`;
const otherHash = `sha256:${'c'.repeat(64)}`;
const sourceHead = 'b'.repeat(40);
const observedAt = '2026-09-02T00:00:00.000Z';
const contextRef = (ref, head = null) => ({ ref, fingerprint: hash, sourceHead: head, observedAt });

const sourceRoot = 'D:/Repositories/starci-academy-backend';

const validInput = {
  schemaVersion: 8,
  operatorId: 'workspace.bind',
  context: {
    bootstrapRefs: [contextRef('source://starci-academy-backend/CLAUDE.md', sourceHead)],
    declarationRefs: [contextRef('workspace://declarations/starci-academy')],
    portableRoute: {
      ref: '.workspaces/projects/starci-academy/be.json',
      fingerprint: hash,
      project: 'starci-academy',
      role: 'be',
      repository: {
        kind: 'source',
        directory: null,
        gitRepository: 'git@github.com:starci183/starci-academy-backend.git',
        branch: 'mtp',
      },
    },
    hydratedRoute: {
      ref: '.workspaces/local/routes/starci-academy/be/config.json',
      fingerprint: hash,
      project: 'starci-academy',
      role: 'be',
      sourceRootPath: sourceRoot,
      workspaceRootPath: `${sourceRoot}/.workspaces`,
      repository: {
        diskPath: sourceRoot,
        gitRoot: sourceRoot,
        gitRepository: 'git@github.com:starci183/starci-academy-backend.git',
        branch: 'mtp',
      },
    },
    identity: {
      ref: 'workspace://identity/device',
      fingerprint: hash,
      machineId: 'starci-workstation',
      credentialRosterRef: 'workspace://identity/roster.age',
      rosterEncrypted: true,
    },
    runtime: {
      registryRef: '.worktrees/sessions/central-runtime/owner.json',
      fingerprint: hash,
      ownerTaskId: 'task-central-runtime',
      generation: 4,
      status: 'ready',
      endpointBinding: {
        authority: 'workspace-route-port-projection',
        project: 'starci-academy',
        application: 'academy',
        services: { frontend: 'webApp', api: 'api', identity: 'keycloak' },
        authorityFingerprint: otherHash,
      },
      endpoints: {
        frontend: 'http://localhost:3000',
        api: 'http://localhost:3001',
        identity: 'http://localhost:8080',
      },
      healthEvidenceRefs: ['runtime://probe/frontend', 'runtime://probe/api', 'runtime://probe/identity'],
    },
    provenance: {
      headRef: 'provenance://starci-academy/be/head',
      headSha256: hash,
      snapshotSha256: otherHash,
      sourceRevision: sourceHead,
      redacted: true,
    },
    cachedRouteReceipt: {
      receiptRef: 'session://tasks/bind/previous-receipt.json',
      project: 'starci-academy',
      role: 'be',
      routeFingerprint: hash,
      sourceHead,
      status: 'fresh',
    },
    hints: [
      { ref: 'D:/Repositories/starci-academy-frontend', kind: 'similar-name', authoritative: false },
      { ref: 'http://localhost:3000/dashboard', kind: 'browser-url', authoritative: false },
    ],
  },
  input: {
    invocationId: 'invocation-bind-1',
    missionId: 'mission-dashboard',
    project: 'starci-academy',
    role: 'be',
    frozenSourceHead: sourceHead,
    gitPolicy: { worktreeBranches: 'forbidden', mutationBranch: 'mtp' },
    observedCheckout: {
      diskPath: sourceRoot,
      branch: 'mtp',
      head: sourceHead,
      originUrl: 'git@github.com:starci183/starci-academy-backend.git',
      dirtyPaths: ['src/features/api/core/graphql/queries/queries.module.ts'],
    },
    declaredWriteRoots: ['src/features/api/core'],
    runtimeNeed: 'consume',
    artifactRootRef: '.v8/artifacts/invocation-bind-1',
    resume: null,
  },
};

const routeArtifactRef = `${validInput.input.artifactRootRef}/route-receipt.json`;
const evidenceRefs = [
  '.workspaces/projects/starci-academy/be.json',
  '.workspaces/local/routes/starci-academy/be/config.json',
  '.worktrees/sessions/central-runtime/owner.json',
];

const binding = {
  projectId: 'starci-academy',
  role: 'be',
  portableRouteRef: '.workspaces/projects/starci-academy/be.json',
  hydratedRouteRef: '.workspaces/local/routes/starci-academy/be/config.json',
  routeFingerprint: hash,
  identityFingerprint: hash,
  sourceHead,
  artifactRootRef: validInput.input.artifactRootRef,
  inputFingerprint: hash,
  progressFingerprint: otherHash,
};

const validBoundOutput = {
  schemaVersion: 8,
  operatorId: 'workspace.bind',
  output: {
    outcome: 'bound',
    receipt: {
      receiptType: 'workspace-route-binding',
      receiptId: 'receipt:starci-academy-be-route',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'bound',
      binding,
      route: {
        routeArtifactRef,
        checkout: {
          diskPath: sourceRoot,
          gitRoot: sourceRoot,
          gitRepository: 'git@github.com:starci183/starci-academy-backend.git',
          branch: 'mtp',
          repositoryKind: 'source',
          directory: null,
          sourceHead,
        },
        gitPolicy: { worktreeBranches: 'forbidden', mutationBranch: 'mtp' },
        mutationReadiness: 'ready',
        writeRoots: ['src/features/api/core'],
        authorityRoots: { businesses: `${sourceRoot}/.worktrees/businesses` },
        runtime: {
          ownerTaskId: 'task-central-runtime',
          generation: 4,
          status: 'ready',
          consumerRole: 'consumer',
          endpointBinding: {
            authority: 'workspace-route-port-projection',
            project: 'starci-academy',
            application: 'academy',
            services: { frontend: 'webApp', api: 'api', identity: 'keycloak' },
            authorityFingerprint: otherHash,
          },
          endpoints: {
            frontend: 'http://localhost:3000',
            api: 'http://localhost:3001',
            identity: 'http://localhost:8080',
          },
        },
        provenanceHeadRef: 'provenance://starci-academy/be/head',
      },
      findings: [
        {
          code: 'ROUTE_HYDRATED_FROM_PORTABLE',
          subject: '.workspaces/local/routes/starci-academy/be/config.json',
          statement: 'The portable declaration resolved to this machine-local route.',
        },
        {
          code: 'HINT_REJECTED',
          subject: 'D:/Repositories/starci-academy-frontend',
          statement: 'A directory whose name resembles the project decided nothing.',
        },
        {
          code: 'HINT_REJECTED',
          subject: 'http://localhost:3000/dashboard',
          statement: 'The origin open in a browser decided nothing.',
        },
        {
          code: 'IDENTITY_ROSTER_SEALED',
          subject: 'workspace://identity/roster.age',
          statement: 'The credential roster was bound by reference and never read.',
        },
        {
          code: 'RUNTIME_CONSUMED_NOT_OWNED',
          subject: 'task-central-runtime',
          statement: 'The caller consumes generation 4 and owns no port or process lifecycle.',
        },
        {
          code: 'WORKTREE_BRANCH_FORBIDDEN',
          subject: 'mtp',
          statement: 'The routed policy forbids task, feature, and worktree branches.',
        },
        {
          code: 'PROVENANCE_HEAD_BOUND',
          subject: 'provenance://starci-academy/be/head',
          statement: 'The redacted conversation head was attached to this binding.',
        },
        {
          code: 'CACHED_ROUTE_REUSED',
          subject: 'session://tasks/bind/previous-receipt.json',
          statement: 'The cached receipt matched the same identity and fingerprints.',
        },
      ],
      evidenceRefs,
      failure: null,
      resume: null,
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [routeArtifactRef],
    handoff: null,
  },
};

const validBlockedOutput = {
  schemaVersion: 8,
  operatorId: 'workspace.bind',
  output: {
    outcome: 'blocked',
    receipt: {
      receiptType: 'workspace-route-binding',
      receiptId: 'receipt:starci-academy-be-route-blocked',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'blocked',
      binding,
      route: null,
      findings: [
        {
          code: 'HINT_REJECTED',
          subject: 'D:/Repositories/starci-academy-frontend',
          statement: 'A directory whose name resembles the project decided nothing.',
        },
      ],
      evidenceRefs,
      failure: {
        code: 'RUNTIME_NOT_READY',
        message: 'The registered runtime owner is still starting; a listening port is not readiness.',
        subjects: ['task-central-runtime'],
        missingRefs: ['.worktrees/sessions/central-runtime/owner.json'],
        retryable: true,
        owningDomain: 'runtime',
      },
      resume: {
        resumeToken: 'resume-workspace-bind-1',
        requiredDelta: ['A ready owner generation with passing probes for all three endpoints.'],
      },
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [],
    handoff: null,
  },
};

assert.deepEqual(validateInput(validInput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validBoundOutput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validBlockedOutput), { valid: true, errors: [] });

// A source route lives at the Source root and owns no directory. One that carries a directory is a
// sibling checkout wearing the Source route's filename.
const sourceRouteWithDirectory = structuredClone(validInput);
sourceRouteWithDirectory.context.portableRoute.repository.directory = 'starci-academy-frontend';
assert.equal(validateInput(sourceRouteWithDirectory).valid, false);

// A sibling route is portable because its directory is relative. An absolute one pins the route
// to one machine's disk and escapes the closed portable declaration entirely.
const absoluteSibling = structuredClone(validInput);
absoluteSibling.context.portableRoute.repository.kind = 'sibling';
absoluteSibling.context.portableRoute.repository.directory = 'D:/Repositories/elsewhere';
const absoluteSiblingResult = validateInput(absoluteSibling);
assert.equal(absoluteSiblingResult.valid, false);
assert.ok(absoluteSiblingResult.errors.some((error) => error.includes('must be relative')));

// A hydrated route whose workspace root is not `.workspaces` under its own Source belongs to
// another machine's Source, and following it lands the work in a foreign checkout.
const foreignSource = structuredClone(validInput);
foreignSource.context.hydratedRoute.workspaceRootPath = 'D:/Repositories/other-source/.workspaces';
assert.equal(validateInput(foreignSource).valid, false);

// The two route halves must agree. A branch difference is a hydration that silently drifted.
const branchDisagreement = structuredClone(validInput);
branchDisagreement.context.hydratedRoute.repository.branch = 'main';
assert.equal(validateInput(branchDisagreement).valid, false);

// A hint is never route authority: the observed checkout must be the hydrated one, not the
// similarly named sibling directory next to it.
const observedSibling = structuredClone(validInput);
observedSibling.input.observedCheckout.diskPath = 'D:/Repositories/starci-academy-frontend';
assert.equal(validateInput(observedSibling).valid, false);

// The routed policy forbids worktree branches, so a task branch is not a bindable state.
const taskBranch = structuredClone(validInput);
taskBranch.input.observedCheckout.branch = 'feature/dashboard';
taskBranch.context.hydratedRoute.repository.branch = 'feature/dashboard';
taskBranch.context.portableRoute.repository.branch = 'feature/dashboard';
assert.equal(validateInput(taskBranch).valid, false);

// Something dirty outside the declared write roots is a condition the operator reports as
// CHECKOUT_DIRTY; the observation itself is valid input, otherwise that failure is unreachable.
const dirtyOutside = structuredClone(validInput);
dirtyOutside.input.observedCheckout.dirtyPaths.push('src/features/socketio/gateway.ts');
assert.deepEqual(validateInput(dirtyOutside), { valid: true, errors: [] });
const checkoutDirty = structuredClone(validBlockedOutput);
checkoutDirty.output.receipt.failure = {
  code: 'CHECKOUT_DIRTY',
  message: 'One dirty path lies outside the declared write roots.',
  subjects: ['src/features/socketio/gateway.ts'],
  missingRefs: [],
  retryable: true,
  owningDomain: 'source',
};
assert.deepEqual(validateOutput(checkoutDirty), { valid: true, errors: [] });

// A caller that consumes the shared runtime must bind the owner, not assume it.
const consumeWithoutOwner = structuredClone(validInput);
consumeWithoutOwner.context.runtime = null;
assert.equal(validateInput(consumeWithoutOwner).valid, false);

// A hint can never be supplied as authoritative; the constant makes it unrepresentable.
const authoritativeHint = structuredClone(validInput);
authoritativeHint.context.hints[0].authoritative = true;
assert.equal(validateInput(authoritativeHint).valid, false);

// The receipt must bind the head of the checkout it actually verified.
// The businesses root is derived from the checkout; a typed one that disagrees is not a route.
const typedAuthorityRoot = structuredClone(validBoundOutput);
typedAuthorityRoot.output.receipt.route.authorityRoots.businesses = 'D:/elsewhere/.worktrees/businesses';
const typedAuthorityRootResult = validateOutput(typedAuthorityRoot);
assert.equal(typedAuthorityRootResult.valid, false);
assert.ok(typedAuthorityRootResult.errors.some((error) => error.includes('derived from the checkout')));

const headDisagreement = structuredClone(validBoundOutput);
headDisagreement.output.receipt.route.checkout.sourceHead = 'd'.repeat(40);
assert.equal(validateOutput(headDisagreement).valid, false);

// Mutation readiness is claimable only on the declared mutation branch.
const readyOffBranch = structuredClone(validBoundOutput);
readyOffBranch.output.receipt.route.checkout.branch = 'feature/dashboard';
const readyOffBranchResult = validateOutput(readyOffBranch);
assert.equal(readyOffBranchResult.valid, false);
assert.ok(readyOffBranchResult.errors.some((error) => error.includes('mutation is ready only on mtp')));

// A loopback alias is not the closed localhost projection, however well it happens to work.
const loopbackAlias = structuredClone(validBoundOutput);
loopbackAlias.output.receipt.route.runtime.endpoints.api = 'http://127.0.0.1:3001';
assert.equal(validateOutput(loopbackAlias).valid, false);

// Neither is a URL with a path; an endpoint is an origin.
const endpointWithPath = structuredClone(validBoundOutput);
endpointWithPath.output.receipt.route.runtime.endpoints.frontend = 'http://localhost:3000/dashboard';
assert.equal(validateOutput(endpointWithPath).valid, false);

// A consumer may only run against a ready owner generation; a degraded one is evidence, not a route.
const degradedRuntime = structuredClone(validBoundOutput);
degradedRuntime.output.receipt.route.runtime.status = 'degraded';
assert.equal(validateOutput(degradedRuntime).valid, false);

// The caller is never the runtime owner, and the constant makes the claim unrepresentable.
const claimedOwnership = structuredClone(validBoundOutput);
claimedOwnership.output.receipt.route.runtime.consumerRole = 'owner';
assert.equal(validateOutput(claimedOwnership).valid, false);

// Consuming a runtime without recording that the caller does not own it would read as ownership.
const unrecordedConsumption = structuredClone(validBoundOutput);
unrecordedConsumption.output.receipt.findings = unrecordedConsumption.output.receipt.findings.filter(
  (item) => item.code !== 'RUNTIME_CONSUMED_NOT_OWNED',
);
assert.equal(validateOutput(unrecordedConsumption).valid, false);

// The portable-to-hydrated resolution is the whole authority of the receipt, so it is never implicit.
const unstatedHydration = structuredClone(validBoundOutput);
unstatedHydration.output.receipt.findings = unstatedHydration.output.receipt.findings.filter(
  (item) => item.code !== 'ROUTE_HYDRATED_FROM_PORTABLE',
);
assert.equal(validateOutput(unstatedHydration).valid, false);

// Three endpoints on one port means two services were never actually projected.
const collidingPorts = structuredClone(validBoundOutput);
collidingPorts.output.receipt.route.runtime.endpoints.identity = 'http://localhost:3001';
assert.equal(validateOutput(collidingPorts).valid, false);

// A runtime failure filed against the caller returns to someone who cannot supply the delta.
const misfiledOwner = structuredClone(validBlockedOutput);
misfiledOwner.output.receipt.failure.owningDomain = 'caller';
assert.equal(validateOutput(misfiledOwner).valid, false);

// A blocked receipt never carries a route.
const blockedWithRoute = structuredClone(validBlockedOutput);
blockedWithRoute.output.receipt.route = validBoundOutput.output.receipt.route;
assert.equal(validateOutput(blockedWithRoute).valid, false);

// A retryable failure without a resume strands the caller with no way back in.
const retryableWithoutResume = structuredClone(validBlockedOutput);
retryableWithoutResume.output.receipt.resume = null;
assert.equal(validateOutput(retryableWithoutResume).valid, false);

// The route receipt must be registered as an artifact, or nothing later can cite it.
const unregisteredArtifact = structuredClone(validBoundOutput);
unregisteredArtifact.output.artifactRefs = [];
assert.equal(validateOutput(unregisteredArtifact).valid, false);

console.log('workspace.bind self-test passed');
