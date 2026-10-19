// Managed Sonar actions share the CLI target, authority, custody and operation journal owners.
// Provider bodies and private values stay inside callbacks; receipts describe separate ACK/readback/consumer proof.
import {resolveProvisionTarget} from './provision-target.mjs';
import {runProvisionOperation, provisionChildEnvironment} from './provision-operation.mjs';
import {requestJson} from '../api/http/request-json.mjs';
import {manage} from '../api/sonar/manage.mjs';
import {resolveConfig, scan} from './sonar-local.mjs';
import {sonarHostCredential} from './sonar-host-connection.mjs';
import {log as gitLog} from '../api/git/log.mjs';
import {statusQuery} from '../api/git/status-query.mjs';
import {findInOrder} from '../lib/in-order.mjs';
import {emailAddress} from '../lib/email-address.mjs';
import {resultCodes, fail, verified, uncertain} from './sonar-managed-results.mjs';
import {sonarTokenAction} from './sonar-token-actions.mjs';

const PROVIDERS = new Set(['sonar-server', 'sonar-community', 'sonar-cloud']);
const TOKEN_TYPES = new Set(['USER_TOKEN', 'PROJECT_ANALYSIS_TOKEN', 'GLOBAL_ANALYSIS_TOKEN']);
const namePattern = /^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,99}$/;
const projectPattern = /^(?=.*[A-Za-z_.:-])[A-Za-z0-9_.:-]{1,400}$/;
const settingPattern = /^[A-Za-z][A-Za-z0-9_.-]{0,199}$/;
const cloudOrigins = new Set(['https://sonarcloud.io', 'https://sonarqube.us']);
const reservedCredentialRoles = new Set(['admin', 'analysis', 'browse', 'existing']);
const research = Object.freeze({readAt: '2026-10-19', sources: [
  'https://docs.sonarsource.com/sonarqube-server/extension-guide/web-api',
  'https://docs.sonarsource.com/sonarqube-community-build/extension-guide/web-api',
  'https://docs.sonarsource.com/sonarqube-server/user-guide/managing-tokens',
  'https://docs.sonarsource.com/sonarqube-server/instance-administration/user-management/creating-users',
  'https://docs.sonarsource.com/sonarqube-server/instance-administration/authentication/overview',
  'https://docs.sonarsource.com/sonarqube-cloud/appendices/web-api',
  'https://raw.githubusercontent.com/SonarSource/sonarqube/master/server/sonar-webserver-webapi/src/main/java/org/sonar/server/user/ws/CreateAction.java',
  'https://raw.githubusercontent.com/SonarSource/sonarqube/master/server/sonar-webserver-webapi-v2/src/main/java/org/sonar/server/v2/api/user/controller/UserController.java',
], constraints: ['Provider API capabilities are checked before writes.',
  'Project analysis permission does not grant Browse permission.',
  'Managed identity providers own their users; local ensure reads active accounts only.',
  'The supported user-create APIs also reactivate inactive logins; explicit create-or-reactivate authority is required.',
  'Token values cannot be retrieved after generation; unknown effects require reconciliation.'],
verification: 'Fixture behavior and native scaffold qualification precede separately authorized live provider and consumer proof.'});

const selectedRows = (rows, field, selected) => {
  if (!Array.isArray(rows) || !rows.length || rows.length > 100 || rows.some(row => !row || typeof row !== 'object')
      || new Set(rows.map(row => row[field])).size !== rows.length) throw new Error('Sonar target does not declare unique selected resources');
  const result = selected === undefined ? rows : rows.filter(row => row[field] === selected);
  if (!result.length || (selected !== undefined && result.length !== 1)) throw new Error('Sonar resource is outside the selected target');
  return result;
};

const closed = (value, names) => Object.keys(value).every(key => names.includes(key));
const publicScalar = value => typeof value === 'number' ? Number.isFinite(value) : ['string', 'boolean'].includes(typeof value);
const validPublicValue = value => publicScalar(value) || Array.isArray(value) && value.every(publicScalar);

const projectRequest = (resource, args) => {
  const name = resource.name ?? resource.projectKey, visibility = resource.visibility;
  if (typeof name !== 'string' || !name.trim() || name.length > 200
      || (visibility !== undefined && !['public', 'private'].includes(visibility)) || (args.name !== undefined && args.name !== name))
    throw new Error('Invalid declared project configuration');
  return {name, visibility};
};

const settingsRequest = (resource, args) => {
  const settings = selectedRows(resource.settings, 'key', args.setting);
  for (const row of settings) {
    if (!closed(row, ['key', 'value', 'secret', 'credentialRole']) || !settingPattern.test(row.key)
        || (row.secret !== undefined && typeof row.secret !== 'boolean') || Boolean(row.secret) !== Boolean(row.credentialRole))
      throw new Error('Invalid declared setting');
    const valid = row.secret ? !Object.hasOwn(row, 'value') && !reservedCredentialRoles.has(row.credentialRole) : validPublicValue(row.value);
    if (!valid) throw new Error('Sonar settings require public values or explicit private credential roles');
  }
  return {settings};
};

const userRequest = (resource, args, target) => {
  if (target.provider === 'sonar-cloud' || resource.userManagement !== 'local') throw new Error('The selected identity provider owns user creation');
  const users = selectedRows(resource.localUsers, 'login', args.login);
  if (users.some(user => !closed(user, ['login', 'name', 'email', 'passwordRole']) || !namePattern.test(user.login) || user.login.length < 2
      || typeof user.name !== 'string' || !user.name || user.name.length > 200 || /[\r\n]/.test(user.name)
      || (user.email !== undefined && !emailAddress(user.email))
      || (user.passwordRole !== undefined && (typeof user.passwordRole !== 'string' || !user.passwordRole || reservedCredentialRoles.has(user.passwordRole)))))
    throw new Error('Invalid declared local user');
  return {users};
};

const tokenRequest = (resource, args) => {
  const rows = selectedRows(resource.tokens, 'name', args.name);
  if (rows.length !== 1) throw new Error('Select exactly one declared token name');
  const token = rows[0];
  if (!closed(token, ['name', 'type', 'projectKey', 'login', 'expirationDate', 'previousName'])
      || !namePattern.test(token.name) || !TOKEN_TYPES.has(token.type) || (args.type !== undefined && token.type !== args.type)
      || (args.login !== undefined && args.login !== token.login)) throw new Error('Invalid declared token identity');
  if ((token.login !== undefined && (typeof token.login !== 'string' || !namePattern.test(token.login)))
      || (token.expirationDate !== undefined && (typeof token.expirationDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(token.expirationDate))))
    throw new Error('Invalid declared token owner or expiration');
  if (token.type === 'PROJECT_ANALYSIS_TOKEN' ? token.projectKey !== resource.projectKey : token.projectKey !== undefined)
    throw new Error('Token scope differs from its declared project');
  if (token.previousName !== undefined && (!namePattern.test(token.previousName) || token.previousName === token.name))
    throw new Error('Rotation needs distinct declared token names');
  return {token};
};

const readRequest = (resource, args, target) => {
  if (args.revision !== undefined && !/^[a-f0-9]{40}$/.test(args.revision)) throw new Error('Expected revision must be a full commit SHA');
  if (target.provider === 'sonar-community' && args.branch !== undefined) throw new Error('Community Build supports only its main analysis');
  return {branch: args.branch, revision: args.revision};
};
const releaseRequest = (resource, args, target) => {
  const release = resource.release;
  if (!release || !closed(release, ['timeoutMs', 'qualityGateTimeoutSeconds']) || !Number.isInteger(release.timeoutMs)
      || release.timeoutMs < 1000 || release.timeoutMs > 7200000 || !Number.isInteger(release.qualityGateTimeoutSeconds)
      || release.qualityGateTimeoutSeconds < 1 || release.qualityGateTimeoutSeconds * 1000 > release.timeoutMs)
    throw new Error('Release requires declared process and quality gate wait bounds');
  return {...readRequest(resource, args, target), release};
};
const requestBuilders = {project: projectRequest, settings: settingsRequest, user: userRequest,
  token: tokenRequest, analysis: readRequest, browse: readRequest, release: releaseRequest};

export const sonarManagedRequest = (target, verb, args) => {
  const resource = target.resource ?? {};
  if (!closed(resource, ['projectKey', 'organization', 'name', 'visibility', 'settings', 'localUsers', 'userManagement', 'tokens', 'release']))
    throw new Error('Undeclared Sonar resource fields');
  if (verb !== 'user' && (!projectPattern.test(resource.projectKey ?? '') || (args.key !== undefined && args.key !== resource.projectKey)))
    throw new Error('Sonar action requires the exact declared project key');
  if (target.provider === 'sonar-cloud' && (!resource.organization || !cloudOrigins.has(target.origin)))
    throw new Error('Sonar Cloud requires its declared organization and regional origin');
  if (resource.organization !== undefined && (typeof resource.organization !== 'string' || !namePattern.test(resource.organization)))
    throw new Error('Invalid declared organization');
  if (target.provider !== 'sonar-cloud' && cloudOrigins.has(target.origin)) throw new Error('Sonar Cloud and Server credential contexts are distinct');
  const build = requestBuilders[verb];
  if (!build) throw new Error('Unsupported Sonar action');
  return Object.fromEntries(Object.entries({projectKey: resource.projectKey, organization: resource.organization,
    ...build(resource, args, target)}).filter(([, value]) => value !== undefined));
};

const requiredRoles = (verb, action, request) => {
  if (verb === 'analysis') return ['analysis', 'browse'];
  if (verb === 'browse') return ['browse'];
  return ['admin', ...(action === 'set' ? request.settings ?? [] : []).filter(row => row.secret).map(row => row.credentialRole),
    ...(action === 'create-or-reactivate' ? request.users ?? [] : []).map(user => user.passwordRole)];
};

// The server's current API declaration, rather than a guessed version, qualifies each write.
const has = (document, endpoint, action, params, write = false) => {
  const selected = document?.webServices?.find(item => item.path === endpoint)?.actions?.find(item => item.key === action);
  if (!selected || (write && selected.post !== true)) return false;
  const names = new Set((selected.params ?? []).map(item => item.key));
  return params.every(name => names.has(name));
};

const projectMatches = (component, request) => component?.key === request.projectKey
  && component.qualifier === 'TRK' && component.name === request.name
  && (request.visibility === undefined || component.visibility === request.visibility)
  && (request.organization === undefined || component.organization === request.organization);

async function projectAction(client, request, callbacks, reconcile) {
  const before = await client.project(request.projectKey);
  if (before.ok) return projectMatches(before.data?.component, request)
    ? verified('sonar-project-exists', {resourceId: request.projectKey}) : fail('sonar-project-conflict');
  if (before.status !== 404) return fail('sonar-project-read-unavailable');
  if (reconcile) return uncertain('sonar-project-not-observed');
  const capabilities = await client.capabilities();
  if (!capabilities.ok || !has(capabilities.data, 'api/projects', 'create', ['project', 'name',
    ...(request.organization ? ['organization'] : []), ...(request.visibility ? ['visibility'] : [])], true)) return fail('sonar-project-api-unsupported');
  callbacks.checkpoint({phase: 'project-create-intent', resourceId: request.projectKey});
  const answer = await client.createProject({...request, key: request.projectKey});
  if (answer.ok) callbacks.acknowledge({phase: 'project-create-acknowledged', resourceId: request.projectKey});
  const after = await client.project(request.projectKey);
  if (after.ok && projectMatches(after.data?.component, request)) return verified('sonar-project-readback', {writeAck: answer.ok, resourceId: request.projectKey});
  return uncertain('sonar-project-create-unreconciled', {writeAck: answer.ok});
}

const settingMatches = (actual, expected) => Array.isArray(expected)
  ? Array.isArray(actual?.values) && JSON.stringify(actual.values) === JSON.stringify(expected.map(String))
  : actual?.value === String(expected);

const settingDefined = (schema, row) => {
  const definition = schema.get(row.key);
  if (!definition || definition.type === 'PROPERTY_SET') return false;
  const privateField = definition.type === 'PASSWORD' || row.key.endsWith('.secured');
  return Boolean(row.secret) === privateField && Boolean(definition.multiValues) === Array.isArray(row.value);
};

/** Stop at the first ambiguous setting write; never start the next write until its predecessor settles. */
async function writeSettings(client, request, callbacks) {
  let acknowledged = false, failure;
  await findInOrder(request.settings, async row => {
    const value = row.secret ? callbacks.credentials[row.credentialRole] : row.value;
    callbacks.checkpoint({phase: 'setting-write-intent', resourceId: row.key});
    const answer = await client.setSetting(request.projectKey, row.key, value);
    if (!answer.ok) {failure = uncertain('sonar-setting-write-unreconciled', {writeAck: acknowledged}); return true;}
    acknowledged = true;
    callbacks.acknowledge({phase: 'setting-write-acknowledged', resourceId: row.key});
    return false;
  });
  return {acknowledged, failure};
}

async function settingsAction(client, request, callbacks, {write, reconcile}) {
  const definitions = await client.settingDefinitions(request.projectKey);
  const schema = new Map((definitions.data?.definitions ?? []).map(row => [row.key, row]));
  if (!definitions.ok || !request.settings.every(row => settingDefined(schema, row))) return fail('sonar-setting-api-unsupported');
  if (write) {
    const capabilities = await client.capabilities();
    if (!capabilities.ok || !has(capabilities.data, 'api/settings', 'set', ['key', 'component',
      ...(request.settings.some(row => Array.isArray(row.value)) ? ['values'] : ['value'])], true)) return fail('sonar-setting-api-unsupported');
  }
  const {acknowledged, failure} = write && !reconcile ? await writeSettings(client, request, callbacks) : {acknowledged: false};
  if (failure) return failure;
  const read = await client.settings(request.projectKey, request.settings.map(row => row.key));
  if (!read.ok) return uncertain('sonar-setting-read-unavailable', {writeAck: acknowledged});
  const values = new Map((read.data?.settings ?? []).map(row => [row.key, row]));
  const publicMatched = request.settings.filter(row => !row.secret).every(row => settingMatches(values.get(row.key), row.value));
  const privateCount = request.settings.filter(row => row.secret).length;
  if (!publicMatched) return fail('sonar-setting-readback-mismatch', {outcome: acknowledged ? 'partial' : 'failed', writeAck: acknowledged});
  return verified('sonar-setting-readback', {writeAck: acknowledged, proof: {
    publicKeys: request.settings.filter(row => !row.secret).map(row => row.key), privateCount, privateValuesVerified: false},
    ...(privateCount ? {outcome: privateOutcome(reconcile)} : {})});
}

const privateOutcome = reconcile => reconcile ? 'partial' : 'applied';
const completeUserPage = answer => answer.ok && Array.isArray(answer.data?.users)
  && Number.isInteger(answer.data?.paging?.total) && answer.data.paging.total >= 0 && answer.data.paging.total === answer.data.users.length;
const userMatches = (actual, user) => actual?.local === true && actual.name === user.name && (!user.email || actual.email === user.email);

async function localUserLookup(client, user) {
  const active = await client.users(user.login, false), inactive = await client.users(user.login, true);
  if (!completeUserPage(active) || !completeUserPage(inactive)) return {failure: fail('sonar-user-read-unavailable')};
  const collision = [...active.data.users, ...inactive.data.users].some(row => typeof row.login === 'string'
    && row.login.toLowerCase() === user.login.toLowerCase() && row.login !== user.login);
  if (collision) return {failure: fail('sonar-user-conflict')};
  return {existing: active.data.users.find(row => row.login === user.login), deactivated: inactive.data.users.find(row => row.login === user.login)};
}

async function createLocalUser(client, user, callbacks) {
  const password = callbacks.credentials[user.passwordRole];
  if (typeof password !== 'string' || !password) return fail('sonar-new-user-password-required');
  callbacks.checkpoint({phase: 'local-user-create-intent', resourceId: user.login});
  const answer = await client.createUser(user);
  if (answer.ok) callbacks.acknowledge({phase: 'local-user-create-acknowledged', resourceId: user.login});
  const after = await client.users(user.login, false);
  const actual = after.data?.users?.find(row => row.login === user.login);
  return after.ok && userMatches(actual, user) ? null : uncertain('sonar-user-create-unreconciled', {writeAck: answer.ok});
}

async function ensureLocalUser(client, user, callbacks, {action, reconcile}) {
  const before = await localUserLookup(client, user);
  if (before.failure) return before.failure;
  if (before.deactivated && (action !== 'create-or-reactivate' || before.deactivated.local !== true)) return fail('sonar-user-inactive');
  if (before.existing) return userMatches(before.existing, user) ? null : fail('sonar-user-conflict');
  if (reconcile) return uncertain('sonar-user-not-observed');
  if (action === 'create-or-reactivate') return createLocalUser(client, user, callbacks);
  callbacks.checkpoint({phase: 'provider-create-only-unavailable', resourceId: user.login, code: 'sonar-user-create-only-unsupported'});
  return fail('sonar-user-create-only-unsupported');
}

async function userAction(client, request, callbacks, {action, reconcile}) {
  const capability = await client.capabilities();
  if (!capability.ok || !has(capability.data, 'api/users', 'search', ['q', 'deactivated'])
      || (action === 'create-or-reactivate' && !has(capability.data, 'api/users', 'create', ['login', 'name', 'password', 'local'], true))) return fail('sonar-user-api-unsupported');
  let writeAck = false, failure;
  const selected = {...callbacks, acknowledge: metadata => {writeAck = true; callbacks.acknowledge(metadata);}};
  await findInOrder(request.users, async user => {
    failure = await ensureLocalUser(client, user, selected, {action, reconcile});
    return Boolean(failure);
  });
  if (failure) return {...failure, writeAck, ...(writeAck && failure.outcome === 'failed' ? {outcome: 'partial'} : {})};
  return verified('sonar-local-users-readback', {writeAck, proof: {logins: request.users.map(user => user.login)}, consumerVerified: false});
}

export async function readSonarBrowse(client, request) {
  const measures = await client.browse(request.projectKey, request.branch);
  const analyses = await client.analyses(request.projectKey, request.branch);
  const issues = await client.issues(request.projectKey, request.branch);
  const qualityGate = await client.qualityGate(request.projectKey, request.branch);
  if (![measures, analyses, issues, qualityGate].every(row => row.ok)) return fail('sonar-browse-unavailable');
  const analysis = analyses.data?.analyses?.[0];
  const total = issues.data?.paging?.total ?? issues.data?.total;
  if (measures.data?.component?.key !== request.projectKey || !analysis?.key || !Number.isInteger(total)) return fail('sonar-browse-incomplete');
  if (request.revision && analysis.revision !== request.revision) return fail('sonar-analysis-revision-mismatch');
  const metrics = Object.fromEntries((measures.data.component.measures ?? []).filter(row =>
    ['coverage', 'duplicated_lines_density', 'violations', 'ncloc'].includes(row.metric) && Number.isFinite(Number(row.value)))
    .map(row => [row.metric, Number(row.value)]));
  const status = qualityGate.data?.projectStatus?.status;
  if (Object.keys(metrics).length !== 4 || !['OK', 'ERROR', 'NONE'].includes(status)) return fail('sonar-browse-incomplete');
  return verified('sonar-browse-read', {consumerVerified: true, resourceId: request.projectKey,
    proof: {analysisId: analysis.key, ...(analysis.revision ? {revision: analysis.revision} : {}), issues: total,
      qualityGate: status, metrics}});
}

export const sonarSourceMatches = (repoRoot, revision) => {
  const head = gitLog(['-1', '--format=%H', 'HEAD'], {cwd: repoRoot});
  const dirty = statusQuery(['--porcelain', '--untracked-files=all'], {cwd: repoRoot});
  return head.status === 0 && String(head.stdout).trim() === revision && dirty.status === 0 && !String(dirty.stdout).trim();
};

async function analysisAction(target, request, callbacks, client, executionEnv) {
  if (!request.revision) return fail('sonar-analysis-revision-required');
  if (!sonarSourceMatches(target.repoRoot, request.revision)) return fail('sonar-analysis-source-mismatch');
  const env = {...provisionChildEnvironment(executionEnv), SONAR_TOKEN: callbacks.credentials.analysis, SONAR_HOST_URL: target.origin};
  const cfg = resolveConfig({cwd: target.repoRoot, host: target.origin, runtimeSecretEnv: value => value,
    fetch: client.readTransport()}, env);
  callbacks.checkpoint({phase: 'analysis-submit-intent', resourceId: request.projectKey});
  const result = await scan(cfg, {cwd: target.repoRoot, key: request.projectKey, wait: true,
    ensure: false, isolate: false, projectGate: true, defines: [`-Dsonar.scm.revision=${request.revision}`]});
  if (result.ceTask?.id) callbacks.acknowledge({phase: 'analysis-submitted', resourceId: result.ceTask.id});
  if (result.outcome !== 'pass' || result.revision?.commit !== request.revision || result.revision?.dirty !== false
      || !sonarSourceMatches(target.repoRoot, request.revision))
    return fail('sonar-analysis-not-verified', {outcome: result.ceTask?.id ? 'partial' : 'failed', writeAck: Boolean(result.ceTask?.id)});
  const readback = await readSonarBrowse(client, request);
  return readback.outcome === 'verified' && readback.proof.analysisId === result.analysisId ? {...readback, code: 'sonar-analysis-processed', writeAck: true,
    proof: {...readback.proof, ceTaskId: result.ceTask.id, qualityGate: result.projectGate?.status}}
    : fail('sonar-analysis-readback-unreconciled', {outcome: 'partial', writeAck: true});
}

/**
 * Execute one catalogued Sonar action through accepted scope and private custody. Source creation does
 * not grant provider effects: without the matching accepted operation, this owner only prepares its plan.
 */
export async function runSonarManage(ctx) {
  try {
    const verb = ctx.command?.verb, action = ctx.positionals?.[0];
    const id = `sonar.${verb}.${action}`;
    if (ctx.operationPolicy?.action !== id) throw new Error('Sonar action policy does not match the selected command');
    const target = resolveProvisionTarget({cwd: ctx.cwd, targetId: ctx.args.target});
    if (!PROVIDERS.has(target.provider)) throw new Error('Selected target is not a Sonar provider');
    const request = sonarManagedRequest(target, verb, ctx.args);
    if (verb === 'user' && action === 'create-or-reactivate' && (!target.actions.includes(id)
        || request.users.some(user => !user.passwordRole || !target.credentials[user.passwordRole])))
      throw new Error('Account reactivation and its private input must be explicitly declared');
    const roles = requiredRoles(verb, action, request);
    const credentialRefs = Object.fromEntries(roles.map(role => [role, target.credentials?.[role]]));
    for (const user of request.users ?? []) {
      if (credentialRefs[user.passwordRole]) credentialRefs[user.passwordRole] = {...credentialRefs[user.passwordRole], optional: true};
      else delete credentialRefs[user.passwordRole];
    }
    if (verb === 'token' && target.credentials?.existing) credentialRefs.existing = {...target.credentials.existing, optional: true};
    return await runProvisionOperation(ctx, {action: id, target, requestId: ctx.args.operation, execute: ctx.args.execute,
      credentialRefs, destination: verb === 'token' && action !== 'revoke' ? target.destination : null,
      publicResource: request, resultCodes,
      hostCredentialOwner: sonarHostCredential,
      plan: {research, effects: {provider: ctx.operationPolicy.effect === 'remote',
        custody: verb === 'token' && action !== 'revoke', reactivateAccounts: action === 'create-or-reactivate',
        replacePasswordOnReactivation: action === 'create-or-reactivate'}, proof: {providerReadback: true, maskedSecretsRequireConsumerProof: true}},
      apply: callbacks => executeAction({verb, action, target, request, callbacks, reconcile: false, env: ctx.env}),
      reconcile: callbacks => executeAction({verb, action, target, request, callbacks, reconcile: true, env: ctx.env}),
    });
  } catch {
    return {code: 2, data: {ok: false, code: 'sonar-managed-execution-failed'}, text: 'Sonar action refused; check the declared target, action scope and private credential references.'};
  }
}

const executeAction = async ({verb, action, target, request, callbacks, reconcile, env}) => {
  const client = manage({target, credentials: callbacks.credentials, request: requestJson});
  if (verb === 'project') return projectAction(client, request, callbacks, reconcile);
  if (verb === 'settings') return settingsAction(client, request, callbacks, {write: action === 'set', reconcile});
  if (verb === 'user') return userAction(client, request, callbacks, {action, reconcile});
  if (verb === 'token') return sonarTokenAction(client, target, request, callbacks, {action, reconcile, env, has});
  if (verb === 'browse' || reconcile) return readSonarBrowse(client, request);
  if (verb === 'analysis') return analysisAction(target, request, callbacks, client, env);
  return fail('sonar-action-unsupported');
};
