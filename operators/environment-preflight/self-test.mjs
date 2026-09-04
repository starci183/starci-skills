// Proves validate.mjs on a synthetic session branch beside a synthetic host: one report with every
// check ok and the branch done, one report blocked on two walls where a declaration wall names a
// near match and the fallback is recorded, and one mutation per law, each of which must fail with a
// line that names the defect. The host root carries its own environment declaration, so the test
// reads no stack of the machine it runs on.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEnvironmentStep, expectedCheckIds, authorizationClasses } from './validate.mjs';
import { loadEnvironmentSchema, stackDeclaration } from '../../scripts/validate-request.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OPERATOR = 'environment.preflight';
const ENV = 'sample-env';
const PROJECT = 'sample-product';

// The synthetic host: a non-production environment that tightens one class to a person.
const host = mkdtempSync(path.join(tmpdir(), 'environment-host-'));
mkdirSync(path.join(host, '.stacks', ENV), { recursive: true });
writeFileSync(path.join(host, '.stacks', ENV, 'environment.json'), JSON.stringify({ schemaVersion: 9, env: ENV, production: false, authorization: { 'external-upload': 'person' } }, null, 2));
// The synthetic host also carries a Playwright install of the shape the walk runner loads — the
// package under the install and a Chromium under its browsers path — so the ready branch is ready;
// the mutation below removes it and the report's ok is refused against the host, not the report.
const { playwrightInstallOf, playwrightInstallStatus, missingInstallMessage } = await import('../../scripts/browser-walk.mjs');
const install = playwrightInstallOf(host, ROOT);
mkdirSync(path.dirname(install.module), { recursive: true });
writeFileSync(install.module, JSON.stringify({ name: 'playwright', version: '0.0.0-synthetic' }));
mkdirSync(path.join(install.browsers, 'chromium-0000'), { recursive: true });
assert.equal(playwrightInstallStatus(host, ROOT).present, true, 'the synthetic install is the shape the runner loads');
const envSchema = await loadEnvironmentSchema(ROOT);
const reportSchema = JSON.parse(await readFile(path.join(ROOT, 'templates', 'kinds', 'readiness-report.schema.json'), 'utf8'));
const CLASSES = authorizationClasses(envSchema);
const declaration = await stackDeclaration(ROOT, ENV, host, envSchema);
assert.equal(declaration.errors.length, 0, 'the synthetic declaration passes its schema');

// Evidence per check, the shape a real run writes: an outcome, a name, a length or a digest.
function evidenceFor(id, authorization) {
  const [family, second] = id.split('.');
  if (family === 'declaration') return 'the portable declaration and its hydrated route both resolve';
  if (family === 'checkout') return { policy: 'the route declares session-only worktrees on its mutation branch', clean: 'the working tree is clean', branch: 'the checkout sits on the mutation branch' }[id.split('.')[2]];
  if (id === 'identity.custody') return 'custody bound: identity-admin, 32 bytes sealed';
  if (id === 'identity.flow.account') return 'the account record names one alias with its credential name';
  if (id === 'identity.flow.signin') return 'sign-in answered 200 with the password resolved by name';
  if (family === 'runtime') return { entry: 'the registry holds the entry of this route', head: 'the served head contains the checkout head', port: 'the projected port answers 200', holder: 'the port is held by the process the registry records' }[id.split('.')[2]];
  if (id === 'host.browser') return 'a browser binary resolves for the audit profile';
  if (id === 'host.playwright') return 'playwright 0.0.0-synthetic and a chromium stand at the install the runner loads';
  if (id === 'host.container') return 'the container daemon answers an inspection';
  if (second === 'deps') return 'the installed manifest matches the lockfile';
  if (second === 'types') return 'no ancestor node_modules reaches the typecheck';
  if (family === 'approval') return `${authorization[id.slice('approval.'.length)]}, read from the declaration`;
  return 'observed';
}
function buildReport({ project = PROJECT, roles = ['fe', 'be'], env = ENV, flow = null, walls = [], statuses = {}, declarationRef = declaration.reference } = {}) {
  const wallById = new Map(walls.map((w) => [w.checkId, w]));
  const checks = expectedCheckIds(reportSchema, roles, CLASSES).map((id) => {
    const wall = wallById.get(id);
    let status = wall ? 'wall' : statuses[id] ?? 'ok';
    if (!wall && flow === null && id.startsWith('identity.flow.')) status = 'skipped';
    for (const role of roles) if (!wall && wallById.has(`declaration.${role}`) && id !== `declaration.${role}` && (id.split('.')[1] === role && !id.startsWith('declaration.') || (id.startsWith('host.') && id.endsWith(`.${role}`)))) status = 'skipped';
    const evidence = status === 'skipped' ? 'not inspectable: the requirement or the declaration it needs is absent' : wall ? wall.evidence : evidenceFor(id, declaration.authorization);
    return { id, family: id.split('.')[0], status, evidence, owner: wall ? wall.owner : null };
  });
  return { project, roles, env, flow, declarationRef, checks, walls: walls.map(({ checkId, owner, repair }) => ({ checkId, owner, repair })), generatedAt: '2026-09-04T00:00:00Z' };
}
function receiptOf(report, { fallbacks = [], suggestion = null } = {}) {
  const checks = report.checks.map((c) => `| \`${c.id}\` | ${c.family} | ${c.status} | ${c.evidence} |`).join('\n');
  const walls = report.walls.map((w) => `| \`${w.checkId}\` | ${w.owner} | ${w.repair} |`).join('\n');
  const taken = fallbacks.map((code) => `| \`${code}\` | ${code === 'ROUTE_NAME_NEAR_MATCH' ? `the requested name is not declared and \`${suggestion}\` is; the wall stands and the name was not switched` : 'recorded'} |`).join('\n');
  return `# environment-readiness — ${report.project}

Every readiness question of ${report.project} answered once, before any chain opens.

## Binding

| Field | Value |
| --- | --- |
| Project | ${report.project} |
| Roles | ${report.roles.join(', ')} |
| Environment | ${report.env} |
| Flow | ${report.flow ?? '—'} |
| Declaration | ${report.declarationRef ?? '—'} |

## Checks

| Check | Family | Status | Evidence |
| --- | --- | --- | --- |
${checks}

## Walls

| Wall | Owner | Repair |
| --- | --- | --- |
${walls}${walls ? '\n' : ''}
## Fallbacks taken

| Code | Action |
| --- | --- |
${taken}${taken ? '\n' : ''}`;
}
const requestJson = ({ project = PROJECT, roles = ['fe', 'be'], flow = null, env = ENV, extra = {} } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, sessionId: 's-test',
  contexts: [{ alias: `@workspaces/projects/${project}/fe`, head: null }, { alias: '@workspaces/device-state', head: null }, { alias: '@worktrees/sessions/central-runtime', head: null }],
  requirements: { project, roles, env, flow, runtimeRoles: roles, resume: null, ...extra },
  inputs: {}, resume: null,
});
const responseJson = ({ status = 'done', stop, fallbacks = [], reason, fields = null, next = [] } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, status, ...(stop ? { stop } : {}), fallbacks,
  fields: fields ?? { 'environment-readiness': 'response/response.md', 'readiness-report': 'response/data/readiness-report.json' },
  ...(reason ? { reason } : {}), commits: [], next,
});

function writeBranch(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'environment-session-'));
  const branch = path.join(session, 'step-1', 'parallel-1');
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: PROJECT, startedAt: '2026-09-04T00:00:00Z', requestHashes: {}, chain: [['1/1']], steps: { '1/1': OPERATOR }, current: '1/1', status: 'running' }));
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}
async function run(files) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateEnvironmentStep(branch, ROOT, host);
  rmSync(session, { recursive: true, force: true });
  return errors;
}
async function expectValid(files, label) { assert.deepEqual(await run(files), [], `${label} should be valid`); }
async function expectError(files, needle, label) {
  const errors = await run(files);
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

// One lawful branch with every wall clear.
const ready = ({ statuses } = {}) => {
  const report = buildReport({ statuses });
  return { 'request/request.json': requestJson(), 'response/response.json': responseJson({ next: ['workspace.bind'] }), 'response/response.md': receiptOf(report), 'response/data/readiness-report.json': report };
};
// One lawful branch blocked on two walls: a role whose name nearly matches a declaration, and a port
// a foreign process holds.
const SUGGESTED = 'fe';
const WALLS = [
  { checkId: 'declaration.fe-app', owner: 'declaration', repair: `no declaration names role \`fe-app\`; suggested \`${SUGGESTED}\` differs by a suffix`, evidence: 'no portable declaration for this role; one declaration differs by a suffix' },
  { checkId: 'runtime.be.holder', owner: 'runtime', repair: 'the platform attests the holder or stops it; nothing is reclaimed here', evidence: 'the projected port answers while the registry records no server for it' },
];
const blocked = ({ walls = WALLS, fallbacks = ['ROUTE_NAME_NEAR_MATCH'], reason, statuses } = {}) => {
  const report = buildReport({ roles: ['fe-app', 'be'], walls, statuses });
  const text = reason ?? `Two walls stand: ${walls.map((w) => w.checkId).join(' and ')}; the person clears both, then the chain re-enters.`;
  return {
    'request/request.json': requestJson({ roles: ['fe-app', 'be'] }),
    'response/response.json': responseJson({ status: 'blocked', stop: 'ENVIRONMENT_NOT_READY', fallbacks, reason: text }),
    'response/response.md': receiptOf(report, { fallbacks, suggestion: SUGGESTED }),
    'response/data/readiness-report.json': report,
  };
};
const withReport = (files, report) => ({ ...files, 'response/response.md': receiptOf(report), 'response/data/readiness-report.json': report });
const mutate = (files, edit) => { const report = structuredClone(files['response/data/readiness-report.json']); edit(report); return { ...files, 'response/data/readiness-report.json': report }; };
const mutateBoth = (files, edit) => { const report = structuredClone(files['response/data/readiness-report.json']); edit(report); return withReport(files, report); };
const flowNamed = () => {
  const report = buildReport({ flow: 'sign-in' });
  return { ...ready(), 'request/request.json': requestJson({ flow: 'sign-in' }), 'response/response.md': receiptOf(report), 'response/data/readiness-report.json': report };
};

await expectValid(ready(), 'every check ok and the branch done');
// The runtime family follows runtimeRoles: skipped for a role the chain never touches, inspected for one it does.
const runtimeIds = (role) => expectedCheckIds(reportSchema, [role], CLASSES).filter((id) => id.startsWith(`runtime.${role}.`));
const skippedRuntime = (roles) => Object.fromEntries(roles.flatMap((r) => runtimeIds(r).map((id) => [id, 'skipped'])));
await expectValid({ ...ready({ statuses: skippedRuntime(['fe', 'be']) }), 'request/request.json': requestJson({ extra: { runtimeRoles: [] } }) }, 'a chain that touches no runtime skips the runtime family and is done');
await expectError({ ...ready(), 'request/request.json': requestJson({ extra: { runtimeRoles: [] } }) }, 'while the chain touches no fe runtime', 'a runtime inspected for a role the chain never touches');
await expectError({ ...ready({ statuses: skippedRuntime(['fe']) }), 'request/request.json': requestJson({ extra: { runtimeRoles: ['fe', 'be'] } }) }, 'while the chain touches the fe runtime', 'a runtime skipped for a role the chain observes');
await expectValid(flowNamed(), 'a named flow with both flow checks run');
await expectValid(blocked(), 'blocked on two walls with a near-match fallback');
await expectValid({ ...ready(), 'response/response.json': responseJson({ status: 'blocked', stop: 'INVALID_INPUT', fields: {} }), 'response/response.md': null, 'response/data/readiness-report.json': null }, 'a gate stop with no report');

// Presence and status.
await expectError({ ...ready(), 'response/response.json': responseJson({ status: 'blocked', stop: 'INVALID_INPUT' }) }, 'is a gate stop and carries no readiness report', 'a gate stop that carries a report');
await expectError({ ...blocked(), 'response/response.json': responseJson({ fallbacks: ['ROUTE_NAME_NEAR_MATCH'] }) }, 'the branch is done while 2 wall(s) stand', 'done while walls stand');
await expectError({ ...ready(), 'response/response.json': responseJson({ status: 'blocked', stop: 'ENVIRONMENT_NOT_READY', reason: 'nothing stands' }) }, 'while the report records no wall', 'blocked with no wall');
await expectError({ ...blocked(), 'response/data/readiness-report.json': null, 'response/response.json': responseJson({ status: 'blocked', stop: 'ENVIRONMENT_NOT_READY', fallbacks: ['ROUTE_NAME_NEAR_MATCH'], reason: 'walls', fields: { 'environment-readiness': 'response/response.md' } }) }, 'still carries the complete report', 'a blocked branch that dropped the report');

// Completeness and agreement.
await expectError(mutateBoth(ready(), (r) => { r.checks = r.checks.filter((c) => c.id !== 'host.browser'); }), 'check host.browser was not run', 'a check that stayed silent');
await expectError(mutateBoth(ready(), (r) => { r.checks.push({ id: 'host.gpu', family: 'host', status: 'ok', evidence: 'observed', owner: null }); }), 'check host.gpu is not in the vocabulary', 'a check outside the vocabulary');
await expectError(mutateBoth(ready(), (r) => { r.checks.push({ ...r.checks[0] }); }), 'is recorded twice', 'a check recorded twice');
await expectError(mutateBoth(ready(), (r) => { r.checks[0].family = 'checkout'; }), "a check's family is the first segment of its id", 'a family that is not the id prefix');
await expectError(mutate(ready(), (r) => { r.checks.find((c) => c.id === 'host.browser').status = 'skipped'; }), 'check host.browser says ok, the report says skipped', 'the receipt and the report disagree on a status');
await expectError({ ...ready(), 'response/response.md': ready()['response/response.md'].replace(/\| `host\.browser` \|[^\n]*\n/, '') }, 'Checks omits host.browser', 'the receipt omits a check');
await expectError({ ...ready(), 'response/response.md': ready()['response/response.md'].replace('| `host.browser` | host |', '| `host.browser` | runtime |') }, 'says family runtime, the report says host', 'the receipt and the report disagree on a family');

// Walls.
await expectError(mutateBoth(blocked(), (r) => { r.walls = r.walls.filter((w) => w.checkId !== 'runtime.be.holder'); }), 'is a wall with no wall entry', 'a wall check with no wall entry');
await expectError(mutateBoth(blocked(), (r) => { r.walls.push({ ...r.walls[1] }); }), 'walls records runtime.be.holder twice', 'a wall entry recorded twice');
await expectError(mutateBoth(ready(), (r) => { r.walls.push({ checkId: 'host.browser', owner: 'host', repair: 'install one' }); }), 'whose status is ok; only a wall check has a wall entry', 'a wall entry for an ok check');
await expectError(mutateBoth(blocked(), (r) => { r.walls[1].owner = 'person'; }), 'says owner runtime and its wall entry says person', 'a check and its wall entry disagree on the owner');
await expectError(mutateBoth(blocked(), (r) => { r.walls[1].owner = 'host'; r.checks.find((c) => c.id === 'runtime.be.holder').owner = 'host'; }), 'a wall is cleared by its family (runtime) or by a person', 'a wall owned by another family');
await expectError(mutateBoth(ready(), (r) => { r.checks.find((c) => c.id === 'host.browser').owner = 'host'; }), 'only a wall has an owner', 'an ok check naming an owner');
await expectError({ ...blocked(), 'response/response.md': blocked()['response/response.md'].replace('| runtime | the platform attests', '| person | the platform attests') }, 'wall runtime.be.holder says owner person, the report says runtime', 'the receipt and the report disagree on a wall owner');
await expectError({ ...blocked(), 'response/response.md': blocked()['response/response.md'].replace(/\| `runtime\.be\.holder` \| runtime \| the platform[^\n]*\n/, '') }, 'Walls omits runtime.be.holder', 'the receipt omits a wall');
await expectError({ ...blocked(), 'response/response.md': blocked()['response/response.md'].replace('nothing is reclaimed here |\n', 'nothing is reclaimed here |\n| `runtime.be.holder` | runtime | again |\n') }, 'Walls lists runtime.be.holder twice', 'a wall listed twice in the receipt');

// The reason.
await expectError(blocked({ reason: 'One wall stands: declaration.fe-app; clear it and re-enter.' }), 'reason does not name wall runtime.be.holder', 'a reason that omits a wall');
await expectError(blocked({ reason: 'Two walls stand:\ndeclaration.fe-app\nruntime.be.holder' }), 'reason spans more than one paragraph', 'a reason in several paragraphs');

// Skips.
await expectError(mutateBoth(blocked(), (r) => { r.checks.find((c) => c.id === 'checkout.fe-app.clean').status = 'ok'; }), 'while declaration.fe-app is a wall', 'a checkout inspected with no declared route');
await expectError(mutateBoth(ready(), (r) => { r.checks.find((c) => c.id === 'checkout.fe.clean').status = 'skipped'; }), 'while declaration.fe is ok; a declared route has a checkout to inspect', 'a checkout skipped under a declared route');
await expectError(mutateBoth(ready(), (r) => { r.checks.find((c) => c.id === 'identity.flow.signin').status = 'ok'; }), 'while no flow was named; both flow checks are skipped', 'a flow probed with no flow named');
await expectError(mutateBoth(flowNamed(), (r) => { r.checks.find((c) => c.id === 'identity.flow.account').status = 'skipped'; }), 'is skipped while flow sign-in was named', 'an account record skipped under a named flow');

// The near match.
await expectError(blocked({ walls: [{ ...WALLS[0], repair: 'no declaration names this role' }, WALLS[1]] }), 'is taken while no declaration wall names a suggested id', 'a fallback with no suggestion');
await expectError(blocked({ fallbacks: [] }), 'and ROUTE_NAME_NEAR_MATCH is not recorded as taken', 'a suggestion with no fallback');
await expectError(blocked({ walls: [WALLS[0], { ...WALLS[1], repair: 'suggested `be-api` instead' }] }), 'only a declaration wall carries a near-match suggestion', 'a suggestion outside a declaration wall');
await expectError(blocked({ walls: [{ ...WALLS[0], repair: 'no declaration names this role; suggested `fe-app`' }, WALLS[1]] }), 'which is the requested name itself', 'a suggestion that repeats the requested name');
await expectError({ ...blocked(), 'response/response.md': blocked()['response/response.md'].replace('`fe` is; the wall stands', 'another is; the wall stands') }, 'fallback does not name the suggested `fe`', 'a fallback row that hides the suggestion');

// Approvals and the declaration.
await expectError(mutateBoth(ready(), (r) => { r.checks.find((c) => c.id === 'approval.release').evidence = 'declared, read from the declaration'; }), 'does not open with person, which the declaration gives the class', 'an approval that contradicts the declaration');
await expectError(mutateBoth(ready(), (r) => { r.checks.find((c) => c.id === 'approval.external-upload').evidence = 'declared, read from the declaration'; }), 'does not open with person', 'a tightened class reported as declared');
await expectError(mutateBoth(ready(), (r) => { const c = r.checks.find((x) => x.id === 'approval.seed'); c.status = 'wall'; c.owner = 'approval'; r.walls.push({ checkId: c.id, owner: 'approval', repair: 'declare it' }); }), 'while the declaration is valid', 'an approval wall under a valid declaration');
await expectError(mutateBoth(ready(), (r) => { r.declarationRef = `.stacks/${ENV}/environment.json#sha256:${'0'.repeat(64)}`; }), 'is not the declaration on disk', 'a declaration reference that moved');
await expectError({ ...ready(), 'request/request.json': requestJson({ env: 'no-such-env' }), ...withReport(ready(), buildReport({ env: 'no-such-env', declarationRef: null })) }, 'names no stack', 'an env with no stack folder');

// Binding and request agreement.
await expectError({ ...ready(), 'request/request.json': requestJson({ project: 'other-product' }) }, 'differs from the request\'s other-product', 'a report for another project');
await expectError({ ...ready(), 'request/request.json': requestJson({ roles: ['fe'] }) }, 'roles fe, be differ from the request\'s fe', 'a report over other roles');
await expectError({ ...ready(), 'response/response.md': ready()['response/response.md'].replace(`| Project | ${PROJECT} |`, '| Project | other-product |') }, 'Project other-product differs from the report\'s', 'a Binding row for another project');
await expectError({ ...ready(), 'response/response.md': ready()['response/response.md'].replace('| Roles | fe, be |', '| Roles | fe |') }, 'Roles "fe" differs', 'a Binding row over other roles');
await expectError({ ...ready(), 'response/response.md': ready()['response/response.md'].replace('| Flow | — |', '| Flow | sign-in |') }, 'Flow sign-in differs', 'a Binding row naming a flow the report did not probe');
await expectError({ ...ready(), 'response/response.md': ready()['response/response.md'].replace(`| Declaration | ${declaration.reference} |`, '| Declaration | — |') }, 'Declaration differs from the report', 'a Binding row that drops the declaration');
await expectError({ ...ready(), 'response/response.md': ready()['response/response.md'].replace(`# environment-readiness — ${PROJECT}`, '# environment-readiness — other-product') }, 'title names other-product', 'a title for another project');

// Custody.
await expectError(mutateBoth(ready(), (r) => { r.checks.find((c) => c.id === 'identity.custody').evidence = 'password: hunter2-resolved'; }), 'carries a credential-shaped value', 'a custody check that printed the value');

// The walk runner's install is read back from the host: a wall over a present install, an ok over an
// absent one, and a wall whose repair does not name the place are each refused.
await expectError(mutateBoth(ready(), (r) => { const c = r.checks.find((x) => x.id === 'host.playwright'); c.status = 'wall'; c.owner = 'host'; r.walls.push({ checkId: c.id, owner: 'host', repair: missingInstallMessage(host, ROOT) }); }), 'while Playwright and a Chromium stand at', 'a playwright wall over a present install');
rmSync(install.root, { recursive: true, force: true });
assert.equal(playwrightInstallStatus(host, ROOT).present, false);
await expectError(ready(), 'is ok while no Playwright install stands at', 'a playwright ok over an absent install');
const playwrightWall = () => {
  const report = buildReport({ walls: [{ checkId: 'host.playwright', owner: 'host', repair: missingInstallMessage(host, ROOT), evidence: 'no package resolves under the install and no chromium sits under its browsers path' }] });
  return { 'request/request.json': requestJson(), 'response/response.json': responseJson({ status: 'blocked', stop: 'ENVIRONMENT_NOT_READY', reason: 'One wall stands: host.playwright; install Playwright once at the host, then the chain re-enters.' }), 'response/response.md': receiptOf(report), 'response/data/readiness-report.json': report };
};
await expectValid(playwrightWall(), 'blocked on the absent walk runner install, in the runner\'s wording');
await expectError(mutateBoth(playwrightWall(), (r) => { r.walls[0].repair = 'install a browser somewhere'; }), 'does not name the install place', 'a playwright wall whose repair names no place');

rmSync(host, { recursive: true, force: true });
process.stdout.write('environment.preflight self-test: two lawful branches, one gate stop and every mutation refused\n');
