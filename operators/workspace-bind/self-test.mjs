// Proves validate.mjs on a synthetic session branch: one conforming bind of a source checkout with no
// runtime, one bind that consumes the shared runtime, one branch blocked on a terminate code, and one
// mutation per law, each of which must fail with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateWorkspaceStep } from './validate.mjs';
import { resolveWorkspaceCheckout } from '../../scripts/workspace-checkout.mjs';
import { workspaceCheckoutFixture } from '../../scripts/workspace-checkout-fixture.mjs';

const head = 'd'.repeat(40);
const fp = (c) => `sha256:${c.repeat(64)}`;
const SOURCE = 'D:/Repositories/starci-academy-backend';
const PORTABLE = '.workspaces/projects/starci-academy/be.json';
const HYDRATED = '.workspaces/local/routes/starci-academy/be/config.json';
const OWNER = 'task-runtime-owner-1';

const runtimeConsumption = (overrides = {}) => ({
  ownerTaskId: OWNER,
  registryEntryKey: 'starci-academy/be',
  served: { branch: 'uat', head: 'f'.repeat(40), contains: [head], port: 3001, leaseSessionId: null },
  identity: { provider: 'the declared identity provider', adminEndpoint: 'http://localhost:8089/admin', realm: 'product', tenant: null, credentialName: 'identity-admin' },
  generation: 3,
  status: 'ready',
  consumerRole: 'consumer',
  endpointBinding: {
    authority: 'workspace-route-port-projection',
    project: 'starci-academy',
    application: 'academy',
    services: { frontend: 'web', api: 'api', identity: 'keycloak' },
    authorityFingerprint: fp('b'),
  },
  endpoints: { frontend: 'http://localhost:3000', api: 'http://localhost:3001', identity: 'http://localhost:8089' },
  ...overrides,
});
function routeBinding(overrides = {}) {
  return {
    project: 'starci-academy', role: 'be',
    portableRouteRef: PORTABLE, hydratedRouteRef: HYDRATED,
    routeFingerprint: fp('a'), identityFingerprint: fp('c'), sourceHead: head,
    checkout: { diskPath: SOURCE, gitRoot: SOURCE, gitRepository: 'git@github.com:starci/academy-backend.git', branch: 'mtp', repositoryKind: 'source', directory: null, sourceHead: head },
    gitPolicy: { worktreeBranches: 'forbidden', mutationBranch: 'mtp' },
    mutationReadiness: 'ready',
    writeRoots: ['src', 'test'],
    authorityRoots: { businesses: `${SOURCE}/.worktrees/businesses` },
    runtime: null,
    provenanceHeadRef: null,
    ...overrides,
  };
}

function responseMd({ binding = routeBinding(), findings = null, runtimeRows = null } = {}) {
  const defaultFindings = [
    ['ROUTE_HYDRATED_FROM_PORTABLE', binding.hydratedRouteRef, 'the portable declaration resolved to this local route'],
    ['IDENTITY_ROSTER_SEALED', 'the credential roster reference', 'the roster was bound by name and never read'],
    ...(binding.gitPolicy.worktreeBranches === 'forbidden' ? [['WORKTREE_BRANCH_FORBIDDEN', binding.gitPolicy.mutationBranch, 'the routed policy forbids task and worktree branches']] : []),
    ...(binding.gitPolicy.worktreeBranches === 'session-only' ? [['WORKTREE_BRANCH_SESSION_ONLY', binding.gitPolicy.mutationBranch, 'the routed policy permits a session worktree branch']] : []),
    ...(binding.provenanceHeadRef ? [['PROVENANCE_HEAD_BOUND', binding.provenanceHeadRef, 'a redacted conversation head was attached']] : []),
    ...(binding.runtime ? [['RUNTIME_CONSUMED_NOT_OWNED', binding.runtime.ownerTaskId, 'the caller consumes the owner endpoints and owns no lifecycle']] : []),
    ...(binding.runtime ? [['RUNTIME_HEAD_CONTAINS_BOUND_COMMIT', binding.sourceHead, 'the served head contains the head this route bound']] : []),
  ];
  const rows = (findings ?? defaultFindings).map(([code, subject, statement]) => `| \`${code}\` | ${subject} | ${statement} |`).join('\n');
  const runtime = runtimeRows ?? (binding.runtime
    ? [['Owner task', binding.runtime.ownerTaskId], ['Status', binding.runtime.status], ['Consumer role', binding.runtime.consumerRole], ['Served branch', binding.runtime.served.branch], ['Served head', binding.runtime.served.head], ['Frontend', binding.runtime.endpoints.frontend], ['Api', binding.runtime.endpoints.api], ['Identity', binding.runtime.endpoints.identity]]
    : []);
  const runtimeTable = runtime.map(([k, v]) => `| ${k} | ${v} |`).join('\n');
  const writeRootRows = binding.writeRoots.map((p) => `| ${p} | the only paths later work may write |`).join('\n');
  return `# workspace-route-binding — ${binding.project}/${binding.role}

The routed backend checkout of this project, bound at the frozen head with its declared write roots.

## Binding

| Field | Value |
| --- | --- |
| Project | ${binding.project} |
| Role | ${binding.role} |
| Portable route | ${binding.portableRouteRef} |
| Hydrated route | ${binding.hydratedRouteRef} |
| Source head | ${binding.sourceHead} |

## Checkout

| Field | Value |
| --- | --- |
| Disk path | ${binding.checkout.diskPath} |
| Git root | ${binding.checkout.gitRoot} |
| Git repository | ${binding.checkout.gitRepository} |
| Branch | ${binding.checkout.branch} |
| Repository kind | ${binding.checkout.repositoryKind} |
| Directory | ${binding.checkout.directory ?? '—'} |
| Source head | ${binding.checkout.sourceHead} |
| Mutation readiness | ${binding.mutationReadiness} |
| Businesses root | ${binding.authorityRoots.businesses ?? '—'} |

## Policy

| Field | Value |
| --- | --- |
| Worktree branches | ${binding.gitPolicy.worktreeBranches} |
| Mutation branch | ${binding.gitPolicy.mutationBranch} |

## Write roots

| Path | Why |
| --- | --- |
${writeRootRows}

## Runtime

| Field | Value |
| --- | --- |
${runtimeTable}${runtimeTable ? '\n' : ''}
## Findings

| Code | Subject | Statement |
| --- | --- | --- |
${rows}
`;
}

const requestJson = ({ runtimeNeed = 'none', extra = {} } = {}) => ({
  schemaVersion: 9, operatorId: 'workspace.bind', step: 1, parallel: 1, sessionId: 's-test',
  contexts: [{ alias: '@workspaces/projects/starci-academy/be', head: null }, { alias: '@workspaces/local/routes/starci-academy/be', head }, { alias: '@workspaces/device-state', head: null }],
  requirements: { project: 'starci-academy', role: 'be', gitPolicy: { worktreeBranches: 'forbidden', mutationBranch: 'mtp' }, declaredWriteRoots: ['src', 'test'], runtimeNeed, resume: null, ...extra },
  inputs: {}, resume: null,
});
function responseJson({ status = 'done', stop, fallbacks = [], fields = null, next = [] } = {}) {
  return {
    schemaVersion: 9, operatorId: 'workspace.bind', step: 1, parallel: 1, status, ...(stop ? { stop } : {}), fallbacks,
    fields: fields ?? { 'workspace-route-binding': 'response/response.md', route: 'response/data/route.json' },
    commits: [], next,
  };
}

function writeBranch(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'workspace-session-'));
  const branch = path.join(session, 'step-1', 'parallel-1');
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: 'starci-academy', startedAt: '2026-09-03T00:00:00Z', requestHashes: {}, chain: [['1/1']], steps: { '1/1': 'workspace.bind' }, current: '1/1', status: 'running' }));
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}
const baseline = () => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/response.md': responseMd(),
  'response/data/route.json': routeBinding(),
});
const withBinding = (binding, requestOverrides = {}) => ({
  ...baseline(),
  'request/request.json': requestJson(requestOverrides),
  'response/data/route.json': binding,
  'response/response.md': responseMd({ binding }),
});

async function expectValid(files, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateWorkspaceStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateWorkspaceStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

const consuming = () => withBinding(routeBinding({ runtime: runtimeConsumption() }), { runtimeNeed: 'consume' });

await expectValid(baseline(), 'a source checkout bound with no runtime');
await expectValid(consuming(), 'a bind that consumes the shared runtime');
await expectValid({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'ROUTE_UNDECLARED', fields: {} }), 'response/response.md': null, 'response/data/route.json': null }, 'blocked on an undeclared route');

await expectError({ ...baseline(), 'response/response.json': { ...responseJson(), stop: 'ROUTE_UNDECLARED' } }, 'only a blocked response carries a stop', 'done with a stop');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'MADE_UP_CODE', fields: {} }), 'response/response.md': null, 'response/data/route.json': null }, 'not a registered code', 'unknown stop code');
await expectError({ ...baseline(), 'response/response.json': responseJson({ fallbacks: ['CHECKOUT_DIRTY'] }) }, 'has disposition terminate under these requirements; it cannot be taken as a fallback', 'fallback on a terminate code');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'ROUTE_MISMATCH' }) }, 'a blocked branch cannot carry a route', 'blocked while binding a route');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { mystery: 1 } }) }, 'requirements.mystery is not a field', 'undeclared requirement');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { project: '' } }) }, 'required field project has no value', 'missing required project');
await expectError(withBinding(routeBinding({ checkout: { ...routeBinding().checkout, directory: 'academy' } })), 'a source checkout must report a null directory', 'a source checkout carrying a directory');
await expectError(withBinding(routeBinding({ checkout: { ...routeBinding().checkout, repositoryKind: 'sibling' } })), 'a sibling checkout carries no business authority root', 'a sibling checkout claiming business authority');
await expectError(withBinding(routeBinding({ authorityRoots: { businesses: '.worktrees/businesses' } })), 'must be derived from the checkout as', 'a typed businesses root');
await expectError(withBinding(routeBinding({ checkout: { ...routeBinding().checkout, branch: 'feature/x' } })), 'a forbidden worktree policy cannot bind a route on another branch', 'a forbidden policy on a task branch');
await expectError(withBinding(routeBinding({ gitPolicy: { worktreeBranches: 'allowed', mutationBranch: 'mtp' }, checkout: { ...routeBinding().checkout, branch: 'feature/x' } }), { extra: { gitPolicy: { worktreeBranches: 'allowed', mutationBranch: 'mtp' } } }), 'mutation is ready only on mtp or a declared session branch, not on feature/x', 'mutation ready off the mutation branch');
await expectValid(withBinding(routeBinding({ gitPolicy: { worktreeBranches: 'session-only', mutationBranch: 'mtp' }, checkout: { ...routeBinding().checkout, branch: 'session/bound-session' } }), { extra: { gitPolicy: { worktreeBranches: 'session-only', mutationBranch: 'mtp' } } }), 'session-only policy permits readiness on a session branch');
await expectError(withBinding(routeBinding({ checkout: { ...routeBinding().checkout, branch: 'session/not-authorized' } })), 'mutation is ready only', 'forbidden policy still refuses session branch readiness');
await expectError(withBinding(routeBinding({ checkout: { ...routeBinding().checkout, gitRoot: `${SOURCE}/api` } })), 'the checkout disk path and Git root must be the same checkout', 'the checkout and its Git root disagree');
await expectError(withBinding(routeBinding({ sourceHead: 'e'.repeat(40) })), 'must name the same source head', 'the binding and the checkout disagree on the head');
await expectError({ ...baseline(), 'request/request.json': requestJson({ runtimeNeed: 'consume' }) }, 'must bind the runtime owner', 'consuming with no runtime bound');
await expectError(withBinding(routeBinding({ writeRoots: ['src'] })), 'which the binding does not carry', 'a declared write root the binding drops');
await expectError(withBinding(routeBinding({ runtime: runtimeConsumption() })), 'runtimeNeed is none, so step 5 never ran and no runtime may be bound', 'a runtime bound without need');
await expectError(withBinding(routeBinding({ runtime: runtimeConsumption({ status: 'starting' }) }), { runtimeNeed: 'consume' }), 'cannot bind a starting runtime owner for consumption', 'a runtime that is not ready');
await expectError(withBinding(routeBinding({ runtime: runtimeConsumption({ endpoints: { frontend: 'http://127.0.0.1:3000', api: 'http://localhost:3001', identity: 'http://localhost:8089' } }) }), { runtimeNeed: 'consume' }), 'is not an origin-only localhost projection', 'a loopback alias as an endpoint');
await expectError(withBinding(routeBinding({ runtime: runtimeConsumption({ endpoints: { frontend: 'http://localhost:3000', api: 'http://localhost:3000', identity: 'http://localhost:8089' } }) }), { runtimeNeed: 'consume' }), 'must resolve to distinct ports', 'two services on one port');
await expectError(withBinding(routeBinding({ runtime: runtimeConsumption({ endpointBinding: { ...runtimeConsumption().endpointBinding, services: { frontend: 'web', api: 'web', identity: 'keycloak' } } }) }), { runtimeNeed: 'consume' }), 'service keys must be distinct', 'two services under one key');
await expectError(withBinding(routeBinding({ runtime: runtimeConsumption({ endpointBinding: { ...runtimeConsumption().endpointBinding, project: 'other-project' } }) }), { runtimeNeed: 'consume' }), 'belongs to another project than the bound route', 'an endpoint binding from another project');
await expectError(withBinding(routeBinding({ runtime: runtimeConsumption({ registryEntryKey: 'starci-academy/fe' }) }), { runtimeNeed: 'consume' }), 'and this route is starci-academy/be', 'a binding that consumed a sibling route entry');
await expectError({ ...consuming(), 'response/response.md': responseMd({ binding: routeBinding({ runtime: runtimeConsumption() }), findings: [['ROUTE_HYDRATED_FROM_PORTABLE', HYDRATED, 'resolved'], ['IDENTITY_ROSTER_SEALED', 'roster', 'sealed'], ['WORKTREE_BRANCH_FORBIDDEN', 'mtp', 'forbidden'], ['RUNTIME_HEAD_CONTAINS_BOUND_COMMIT', head, 'contained']] }) }, 'must record that the caller does not own it', 'a consumed runtime with no ownership finding');
await expectError({ ...baseline(), 'response/response.md': responseMd({ findings: [['IDENTITY_ROSTER_SEALED', 'roster', 'sealed'], ['WORKTREE_BRANCH_FORBIDDEN', 'mtp', 'forbidden']] }) }, 'must record the hydrated route it resolved from', 'a bound route with no hydration finding');
await expectError({ ...baseline(), 'response/response.md': responseMd({ findings: [['ROUTE_HYDRATED_FROM_PORTABLE', HYDRATED, 'resolved'], ['IDENTITY_ROSTER_SEALED', 'roster', 'sealed'], ['WORKTREE_BRANCH_FORBIDDEN', 'mtp', 'forbidden'], ['HINT_REJECTED', 'D:/Repositories/starci-academy', 'a similar directory name']] }) }, 'a hint is INVALID_INPUT at the gate', 'a receipt that weighs a hint');
await expectError({ ...baseline(), 'response/response.md': responseMd({ findings: [['ROUTE_HYDRATED_FROM_PORTABLE', HYDRATED, 'resolved'], ['WORKTREE_BRANCH_FORBIDDEN', 'mtp', 'forbidden']] }) }, 'the credential roster was sealed and never read', 'no sealed roster finding');
await expectError({ ...baseline(), 'response/response.md': responseMd({ findings: [['ROUTE_HYDRATED_FROM_PORTABLE', HYDRATED, 'resolved'], ['IDENTITY_ROSTER_SEALED', 'roster', 'sealed']] }) }, 'a forbidden worktree policy must be recorded', 'a forbidden policy that was never recorded');
await expectError({ ...baseline(), 'response/data/route.json': routeBinding({ gitPolicy: { worktreeBranches: 'session-only', mutationBranch: 'mtp' } }), 'request/request.json': requestJson({ extra: { gitPolicy: { worktreeBranches: 'session-only', mutationBranch: 'mtp' } } }) }, 'a session-only worktree policy must be recorded', 'a session-only policy that was never recorded');
await expectError({ ...baseline(), 'response/response.md': responseMd({ findings: [['ROUTE_HYDRATED_FROM_PORTABLE', HYDRATED, 'resolved'], ['ROUTE_HYDRATED_FROM_PORTABLE', HYDRATED, 'resolved again'], ['IDENTITY_ROSTER_SEALED', 'roster', 'sealed'], ['WORKTREE_BRANCH_FORBIDDEN', 'mtp', 'forbidden']] }) }, 'repeats subject', 'a repeated finding subject');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('## Policy', '## Git policy') }, 'missing section ^## Policy$', 'response section renamed');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('| Branch | mtp |', '| Branch | feature/x |') }, 'differs from the route binding', 'the receipt and the binding disagree on the branch');
await expectError({ ...baseline(), 'response/data/route.json': routeBinding({ sourceHead: 'not-a-head' }) }, 'sourceHead', 'route schema');
await expectError({ ...baseline(), 'response/response.json': (() => { const o = responseJson(); delete o.fields.route; return o; })() }, 'required output route is not in fields', 'missing required output');

await expectError(withBinding(routeBinding({ runtime: runtimeConsumption({ served: { branch: 'uat', head: 'f'.repeat(40), contains: ['a'.repeat(40)], port: 3001, leaseSessionId: null } }) }), { runtimeNeed: 'consume' }), "does not contain this route's head", 'a served head that carries other work and not this');
await expectError(withBinding(routeBinding({ runtime: runtimeConsumption({ served: { branch: 'uat', head: 'f'.repeat(40), contains: [head], port: 3999, leaseSessionId: null } }) }), { runtimeNeed: 'consume' }), 'and the entry serves this route on http://localhost:3999', 'an endpoint that is not the port the entry serves this route on');
await expectError({ ...consuming(), 'response/response.md': responseMd({ binding: routeBinding({ runtime: runtimeConsumption() }), findings: [['ROUTE_HYDRATED_FROM_PORTABLE', HYDRATED, 'resolved'], ['IDENTITY_ROSTER_SEALED', 'roster', 'sealed'], ['WORKTREE_BRANCH_FORBIDDEN', 'mtp', 'forbidden'], ['RUNTIME_CONSUMED_NOT_OWNED', OWNER, 'consumed']] }) }, 'the served head contains the head this route bound', 'a consumed runtime whose ancestry the receipt never states');

// New session bindings use real isolated Git worktrees and the installed portable hydrator.
// Legacy fixtures above remain unbound observations and are never silently re-resolved.
{
  const fixture = workspaceCheckoutFixture({ attachRuntime: true });
  try {
    const request = requestJson({ extra: { project: fixture.project, checkout: 'session', gitPolicy: { worktreeBranches: 'session-only', mutationBranch: 'main' }, declaredWriteRoots: ['src'] } });
    request.contexts = [{ alias: `@workspaces/projects/${fixture.project}/be`, head: null }, { alias: `@workspaces/local/routes/${fixture.project}/be`, head: fixture.sessionHead }, { alias: '@workspaces/device-state', head: null }];
    const branch = fixture.freezeRequest(request);
    const binding = { ...resolveWorkspaceCheckout(fixture.options), identityFingerprint: fp('c'), authorityRoots: { businesses: null }, runtime: null, provenanceHeadRef: null };
    fixture.write(path.join(branch, 'response/response.json'), responseJson());
    fixture.write(path.join(branch, 'response/response.md'), responseMd({ binding }));
    fixture.write(path.join(branch, 'response/data/route.json'), binding);
    assert.deepEqual((await validateWorkspaceStep(branch, fixture.runtime)).errors, [], 'registered current-session branch is parent-valid');
    fixture.write(path.join(branch, 'response/data/route.json'), { ...binding, sessionCheckout: { ...binding.sessionCheckout, sessionId: 'another-session' } });
    assert.ok((await validateWorkspaceStep(branch, fixture.runtime)).errors.some(error => error.includes('sessionCheckout differs')), 'response validator independently rejects a foreign session identity');
    fixture.write(path.join(branch, 'response/data/route.json'), binding);
    fixture.write(path.join(branch, 'response/response.md'), responseMd({ binding }).replace(`| Disk path | ${binding.checkout.diskPath} |`, `| Disk path | ${fixture.canonical} |`));
    assert.ok((await validateWorkspaceStep(branch, fixture.runtime)).errors.some(error => error.includes('Disk path differs from the selected checkout')), 'receipt cannot describe canonical path while route selects session worktree');
  } finally { fixture.dispose(); }
}

process.stdout.write('workspace.bind self-test: legacy cases and independently verified session checkout branches passed\n');
