// Sonar's managed Web API boundary. Callers supply the resolved target and private role values;
// only fixed provider endpoints are exposed, and response bodies remain private to the use case.

const query = values => new URLSearchParams(Object.entries(values).filter(([, value]) => value !== undefined && value !== null)).toString();
const formBody = values => {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    for (const item of Array.isArray(value) ? value : [value]) body.append(key, String(item));
  }
  return body.toString();
};

/**
 * Construct a private Sonar client for one resolved provider origin. The injected HTTPS owner
 * forbids redirects and bounds responses. Methods accept no URL or shell command; token validation
 * receives a private in-memory value and never produces a credential-bearing receipt.
 */
export function manage({target, credentials, request}) {
  if (typeof request !== 'function') throw new TypeError('Sonar requires the private JSON transport owner');
  const policy = {allowedOrigins: [target.origin], allowHttpLoopback: target.context === 'local'};
  const call = (method, endpoint, role, {params, form} = {}) => {
    const suffix = params ? `?${query(params)}` : '';
    return request({
    origin: target.origin,
    path: endpoint + suffix,
    method,
    headers: {Accept: 'application/json', ...(credentials[role] ? {Authorization: `Bearer ${credentials[role]}`} : {}),
      ...(form ? {'Content-Type': 'application/x-www-form-urlencoded'} : {})},
    ...(form ? {body: formBody(form)} : {}),
    ...(endpoint === '/api/webservices/list' ? {maxBytes: 4 * 1024 * 1024} : {}),
    }, policy);
  };

  return {
    readTransport: () => sonarReadTransport({target, analysisCredential: credentials.analysis,
      browseCredential: credentials.browse, request}),
    capabilities: () => call('GET', '/api/webservices/list', 'admin'),
    project: key => call('GET', '/api/components/show', 'admin', {params: {component: key}}),
    createProject: ({key, name, visibility, organization}) => call('POST', '/api/projects/create', 'admin',
      {form: {project: key, name, visibility, organization}}),
    // Quality gates: the organization parameter scopes each call on SonarQube Cloud and is omitted on a server. `ref` is the
    // gate reference the server's API declares for the action ({gateName} or {gateId}).
    gate: (name, organization) => call('GET', '/api/qualitygates/show', 'admin', {params: {name, organization}}),
    createGate: (name, organization) => call('POST', '/api/qualitygates/create', 'admin', {form: {name, organization}}),
    createCondition: ({ref, metric, op, error, organization}) => call('POST', '/api/qualitygates/create_condition', 'admin',
      {form: {...ref, metric, op, error, organization}}),
    updateCondition: ({id, metric, op, error, organization}) => call('POST', '/api/qualitygates/update_condition', 'admin',
      {form: {id, metric, op, error, organization}}),
    deleteCondition: ({id, organization}) => call('POST', '/api/qualitygates/delete_condition', 'admin', {form: {id, organization}}),
    selectGate: ({ref, projectKey, organization}) => call('POST', '/api/qualitygates/select', 'admin', {form: {...ref, projectKey, organization}}),
    projectGate: (projectKey, organization) => call('GET', '/api/qualitygates/get_by_project', 'admin', {params: {project: projectKey, organization}}),
    settingDefinitions: key => call('GET', '/api/settings/list_definitions', 'admin', {params: {component: key}}),
    settings: (key, keys) => call('GET', '/api/settings/values', 'admin', {params: {component: key, keys: keys.join(',')}}),
    setSetting: (key, setting, value) => call('POST', '/api/settings/set', 'admin',
      {form: {component: key, key: setting, ...(Array.isArray(value) ? {values: value} : {value})}}),
    users: (login, deactivated) => call('GET', '/api/users/search', 'admin', {params: {q: login, deactivated, ps: 500, p: 1}}),
    createUser: user => call('POST', '/api/users/create', 'admin', {form: {login: user.login, name: user.name,
      ...(user.email ? {email: user.email} : {}), local: true, password: credentials[user.passwordRole]}}),
    tokens: login => call('GET', '/api/user_tokens/search', 'admin', {params: {login}}),
    generateToken: token => call('POST', '/api/user_tokens/generate', 'admin', {form: {
      name: token.name, type: token.type, projectKey: token.projectKey, login: token.login, expirationDate: token.expirationDate,
    }}),
    revokeToken: token => call('POST', '/api/user_tokens/revoke', 'admin', {form: {name: token.name, login: token.login}}),
    validateToken: value => request({origin: target.origin, path: '/api/authentication/validate', method: 'GET',
      headers: {Accept: 'application/json', Authorization: `Bearer ${value}`}}, policy),
    browse: (key, branch) => call('GET', '/api/measures/component', 'browse', {params: {component: key,
      metricKeys: 'coverage,duplicated_lines_density,violations,ncloc', branch}}),
    analyses: (key, branch) => call('GET', '/api/project_analyses/search', 'browse', {params: {project: key, branch, ps: 1, p: 1}}),
    issues: (key, branch) => call('GET', '/api/issues/search', 'browse', {params: {componentKeys: key, resolved: false, branch, ps: 1, p: 1}}),
    qualityGate: (key, branch) => call('GET', '/api/qualitygates/project_status', 'browse', {params: {projectKey: key, branch}}),
    qualityGateForAnalysis: analysisId => call('GET', '/api/qualitygates/project_status', 'browse', {params: {analysisId}}),
    ceTask: id => call('GET', '/api/ce/task', 'browse', {params: {id}}),
  };
}

/** Adapt only Sonar GET requests to the existing scanner owner, preserving the fixed origin and role. */
function sonarReadTransport({target, analysisCredential, browseCredential, request}) {
  return async (url, init = {}) => {
    const selected = new URL(url);
    const trusted = new URL(target.origin);
    if (selected.origin !== trusted.origin || !selected.pathname.startsWith(`${trusted.pathname.replace(/\/$/, '')}/api/`)
        || (init.method ?? 'GET') !== 'GET') throw new Error('Sonar scanner API read is outside its resolved target');
    const credential = selected.pathname.endsWith('/api/authentication/validate') ? analysisCredential : browseCredential;
    const response = await request({origin: target.origin,
      path: `${selected.pathname.slice(trusted.pathname.replace(/\/$/, '').length)}${selected.search}`,
      method: 'GET', headers: {Accept: 'application/json', Authorization: `Bearer ${credential}`}},
    {allowedOrigins: [target.origin], allowHttpLoopback: target.context === 'local'});
    return {status: response.status ?? 0, text: async () => response.data === null ? '' : JSON.stringify(response.data)};
  };
}
