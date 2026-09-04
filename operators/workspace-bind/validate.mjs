// workspace.bind's own law over one branch, on top of the shared step check: the receipt and the route
// name the same checkout and head; a source checkout carries no directory and a sibling one
// does; the hydrated route belongs to this Source and to the requested project and role; the observed
// checkout is the one the route resolved to; mutation is ready only on the mutation branch and a
// forbidden worktree policy binds nowhere else; the businesses root is derived from the checkout, never
// typed; a consumed runtime is ready, owned by someone else, bound to this project, and reachable only
// through distinct origin-only localhost projections, and only when runtimeNeed asked for one; no hint
// survives the gate; and a blocked branch records neither a hydration nor a consumed runtime.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// Only an origin-only localhost URL is an endpoint. 127.0.0.1, a host, or a path is not.
const LOCAL_ORIGIN = /^http:\/\/localhost:([1-9][0-9]{0,4})$/;
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const fields = (rows) => Object.fromEntries((rows ?? []).map(([k, v]) => [k, v]));
// Route paths arrive from two files written on different machines, so they are compared as normalised
// strings: separator style and a trailing slash are notation, not identity.
const comparablePath = (value) => String(value).replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();

export async function validateWorkspaceStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'workspace.bind') return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');

  let route = null;
  if (present.has('route') && has('response/data/route.json')) {
    try { route = JSON.parse(await read('response/data/route.json')); } catch { route = null; }
  }
  if (response.status === 'blocked' && route !== null) {
    errors.push('response/response.json: a blocked branch cannot carry a route');
  }

  if (route) {
    const { checkout, gitPolicy, mutationReadiness, runtime } = route;
    if (!empty(requirements.project) && route.project !== requirements.project) errors.push(`response/data/route.json: project ${route.project} differs from the request's ${requirements.project}`);
    if (!empty(requirements.role) && route.role !== requirements.role) errors.push(`response/data/route.json: role ${route.role} differs from the request's ${requirements.role}`);
    if (checkout.sourceHead !== route.sourceHead) errors.push('response/data/route.json: the binding and the routed checkout must name the same source head');
    if (comparablePath(checkout.diskPath) !== comparablePath(checkout.gitRoot)) errors.push('response/data/route.json: the checkout disk path and Git root must be the same checkout');
    if (checkout.repositoryKind === 'source' && checkout.directory !== null) errors.push('response/data/route.json: a source checkout must report a null directory');
    if (checkout.repositoryKind === 'sibling' && checkout.directory === null) errors.push('response/data/route.json: a sibling checkout must report its relative directory');

    // The businesses root is derived from the checkout, never typed by a caller: on a source checkout it
    // is <gitRoot>/.worktrees/businesses when that worktree exists, otherwise null; a sibling checkout
    // carries no business authority. business.decide copies this value.
    const derivedBusinesses = `${String(checkout.gitRoot).replace(/[\\/]+$/, '')}/.worktrees/businesses`;
    const { businesses } = route.authorityRoots;
    if (checkout.repositoryKind === 'sibling' && businesses !== null) errors.push('response/data/route.json: a sibling checkout carries no business authority root');
    if (businesses !== null && businesses !== derivedBusinesses) errors.push(`response/data/route.json: authorityRoots.businesses must be derived from the checkout as ${derivedBusinesses}`);

    // Mutation is ready only on the declared mutation branch. Reporting readiness anywhere else is how a
    // task branch acquires permission it was never routed.
    const asked = requirements.gitPolicy ?? null;
    if (asked && !empty(asked.worktreeBranches) && gitPolicy.worktreeBranches !== asked.worktreeBranches) errors.push(`response/data/route.json: the routed policy ${gitPolicy.worktreeBranches} differs from the request's ${asked.worktreeBranches}`);
    if (asked && !empty(asked.mutationBranch) && gitPolicy.mutationBranch !== asked.mutationBranch) errors.push(`response/data/route.json: the routed mutation branch ${gitPolicy.mutationBranch} differs from the request's ${asked.mutationBranch}`);
    const declaredRoots = Array.isArray(requirements.declaredWriteRoots) ? requirements.declaredWriteRoots : [];
    for (const root of declaredRoots) if (!route.writeRoots.includes(root)) errors.push(`response/data/route.json: the request declared the write root ${root}, which the binding does not carry`);
    const sessionBranch = gitPolicy.worktreeBranches === 'session-only' && /^session\/[A-Za-z0-9._-]+$/.test(checkout.branch);
    if (mutationReadiness === 'ready' && checkout.branch !== gitPolicy.mutationBranch && !sessionBranch) errors.push(`response/data/route.json: mutation is ready only on ${gitPolicy.mutationBranch} or a declared session branch, not on ${checkout.branch}`);
    if (gitPolicy.worktreeBranches === 'session-only' && checkout.branch !== gitPolicy.mutationBranch && !/^session\//.test(checkout.branch)) errors.push(`response/data/route.json: a session-only worktree policy binds only on ${gitPolicy.mutationBranch} or on a session/<sessionId> branch, not on ${checkout.branch}`);
    if (gitPolicy.worktreeBranches === 'forbidden' && checkout.branch !== gitPolicy.mutationBranch) errors.push('response/data/route.json: a forbidden worktree policy cannot bind a route on another branch');

    if (runtime !== null) {
      // A consumer may run only against a ready owner generation. A port that merely listens, a starting
      // owner, or a degraded one is evidence to report, not a runtime to use.
      if ((requirements.runtimeNeed ?? 'none') === 'none') errors.push('response/data/route.json: runtimeNeed is none, so step 5 never ran and no runtime may be bound');
      if (runtime.status !== 'ready') errors.push(`response/data/route.json: a route cannot bind a ${runtime.status} runtime owner for consumption`);
      // The registry holds one entry per project route. A binding reads the entry of its own route, so
      // a route is never reported not ready because a sibling route's entry was the one consulted.
      if (runtime.registryEntryKey !== `${route.project}/${route.role}`) errors.push(`response/data/route.json: the binding consumed registry entry ${runtime.registryEntryKey}, and this route is ${route.project}/${route.role}`);
      if (runtime.endpointBinding.project !== route.project) errors.push('response/data/route.json: the endpoint binding belongs to another project than the bound route');
      // One integration branch carries the work of several sessions, so the served head is almost
      // never this route's head. What a binding must establish is that its own head is inside it.
      const served = runtime.served;
      if (!served.contains.includes(route.sourceHead)) errors.push(`response/data/route.json: the served head ${served.head} does not contain this route's head ${route.sourceHead}, so the running surface carries other work and not this`);
      const serviceOfRole = { fe: 'frontend', be: 'api' }[route.role];
      if (serviceOfRole) {
        const expected = `http://localhost:${served.port}`;
        if (runtime.endpoints[serviceOfRole] !== expected) errors.push(`response/data/route.json: the ${serviceOfRole} endpoint is ${runtime.endpoints[serviceOfRole]} and the entry serves this route on ${expected}`);
      }
      const services = Object.values(runtime.endpointBinding.services);
      if (new Set(services).size !== services.length) errors.push('response/data/route.json: endpoint binding service keys must be distinct');
      const ports = [];
      for (const [role, endpoint] of Object.entries(runtime.endpoints)) {
        const match = LOCAL_ORIGIN.exec(endpoint);
        if (match === null) { errors.push(`response/data/route.json: the ${role} endpoint ${endpoint} is not an origin-only localhost projection`); continue; }
        const port = Number(match[1]);
        if (port > 65535) errors.push(`response/data/route.json: the ${role} endpoint port exceeds 65535`);
        ports.push(port);
      }
      if (new Set(ports).size !== ports.length) errors.push('response/data/route.json: the frontend, api, and identity endpoints must resolve to distinct ports');
    } else if (requirements.runtimeNeed === 'consume' && response.status === 'done') {
      errors.push('response/data/route.json: a caller that consumes the shared runtime must bind the runtime owner');
    }
  }

  if (present.has('workspace-route-binding') && has('response/response.md')) {
    const text = await read('response/response.md');
    const binding = fields(tableUnder(text, '## Binding'));
    const checkout = fields(tableUnder(text, '## Checkout'));
    const policy = fields(tableUnder(text, '## Policy'));
    const runtimeRows = fields(tableUnder(text, '## Runtime'));
    const writeRoots = (tableUnder(text, '## Write roots') ?? []).map(([p]) => p);

    const findingKeys = new Set();
    for (const [code, subject] of tableUnder(text, '## Findings') ?? []) {
      const key = `${code}|${subject}`;
      if (findingKeys.has(key)) errors.push(`response/response.md: finding ${code} repeats subject ${subject}`);
      findingKeys.add(key);
    }

    if (route) {
      if (binding.Project !== route.project) errors.push(`response/response.md: Project ${binding.Project} differs from the route binding's ${route.project}`);
      if (binding.Role !== route.role) errors.push(`response/response.md: Role ${binding.Role} differs from the route binding's ${route.role}`);
      if (binding['Source head'] !== route.sourceHead) errors.push('response/response.md: Source head differs from the route binding');
      if (binding['Hydrated route'] !== route.hydratedRouteRef) errors.push('response/response.md: Hydrated route differs from the route binding');
      if (checkout.Branch !== route.checkout.branch) errors.push(`response/response.md: Branch ${checkout.Branch} differs from the route binding's ${route.checkout.branch}`);
      if (checkout['Mutation readiness'] !== route.mutationReadiness) errors.push('response/response.md: Mutation readiness differs from the route binding');
      if (checkout['Repository kind'] !== route.checkout.repositoryKind) errors.push('response/response.md: Repository kind differs from the route binding');
      const businesses = route.authorityRoots.businesses;
      if ((empty(checkout['Businesses root']) ? null : checkout['Businesses root']) !== businesses) errors.push(`response/response.md: Businesses root ${checkout['Businesses root']} differs from the derived ${String(businesses)}`);
      if (policy['Worktree branches'] !== route.gitPolicy.worktreeBranches) errors.push('response/response.md: Worktree branches differs from the route binding');
      if (policy['Mutation branch'] !== route.gitPolicy.mutationBranch) errors.push('response/response.md: Mutation branch differs from the route binding');
      if (writeRoots.length !== route.writeRoots.length || writeRoots.some((p) => !route.writeRoots.includes(p))) errors.push('response/response.md: Write roots differ from the route binding');

      // The portable-to-hydrated resolution is the whole authority of this receipt, so it is stated
      // rather than assumed.
      if (!findingKeys.has(`ROUTE_HYDRATED_FROM_PORTABLE|${route.hydratedRouteRef}`)) errors.push('response/response.md: a bound route must record the hydrated route it resolved from');
      if (route.gitPolicy.worktreeBranches === 'forbidden' && !findingKeys.has(`WORKTREE_BRANCH_FORBIDDEN|${route.gitPolicy.mutationBranch}`)) errors.push('response/response.md: a forbidden worktree policy must be recorded on the bound route');
      if (route.gitPolicy.worktreeBranches === 'session-only' && !findingKeys.has(`WORKTREE_BRANCH_SESSION_ONLY|${route.gitPolicy.mutationBranch}`)) errors.push('response/response.md: a session-only worktree policy must be recorded on the bound route');
      if (route.provenanceHeadRef !== null && !findingKeys.has(`PROVENANCE_HEAD_BOUND|${route.provenanceHeadRef}`)) errors.push('response/response.md: a bound provenance head must be recorded');
      if (route.runtime !== null) {
        if (!findingKeys.has(`RUNTIME_CONSUMED_NOT_OWNED|${route.runtime.ownerTaskId}`)) errors.push('response/response.md: a consumed runtime must record that the caller does not own it');
        if (runtimeRows['Owner task'] !== route.runtime.ownerTaskId) errors.push('response/response.md: Owner task differs from the route binding');
        if (runtimeRows.Status !== route.runtime.status) errors.push('response/response.md: Runtime status differs from the route binding');
        if (runtimeRows['Consumer role'] !== 'consumer') errors.push('response/response.md: the caller consumes the runtime and never owns it');
        // The two heads are printed side by side, because ancestry a reader cannot see is a claim.
        if (runtimeRows['Served branch'] !== route.runtime.served.branch) errors.push('response/response.md: Served branch differs from the route binding');
        if (runtimeRows['Served head'] !== route.runtime.served.head) errors.push('response/response.md: Served head differs from the route binding');
        if (!findingKeys.has(`RUNTIME_HEAD_CONTAINS_BOUND_COMMIT|${route.sourceHead}`)) errors.push('response/response.md: a consumed runtime must record that the served head contains the head this route bound');
        for (const [label, key] of [['Frontend', 'frontend'], ['Api', 'api'], ['Identity', 'identity']]) {
          if (runtimeRows[label] !== route.runtime.endpoints[key]) errors.push(`response/response.md: the ${key} endpoint differs from the route binding`);
        }
      } else if (Object.keys(runtimeRows).length) errors.push('response/response.md: the Runtime section carries rows but no runtime was bound');
    }

    // Hints are refused at the gate, so no finding may record one as if it had been weighed.
    for (const key of findingKeys) if (key.startsWith('HINT_REJECTED|')) errors.push('response/response.md: a hint is INVALID_INPUT at the gate, so a bound receipt never records HINT_REJECTED');
    // Only the sealed roster reference is bound; no credential is read.
    if (![...findingKeys].some((key) => key.startsWith('IDENTITY_ROSTER_SEALED|'))) errors.push('response/response.md: a bound route must record that the credential roster was sealed and never read');
  } else if (response.status === 'done') {
    errors.push('response/response.md: a bound branch needs the route receipt');
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateWorkspaceStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid workspace.bind branch\n');
}
