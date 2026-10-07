// supabase-stack.mjs - operate only the Supabase project declared by the nearest app config, with no secret output.
import fs from 'node:fs';
import path from 'node:path';
import { portListener } from '../api/process/port-listener.mjs';
import { projectStart as callSupabaseStart } from '../api/supabase/project-start.mjs';
import { projectStatus as callSupabaseStatus } from '../api/supabase/project-status.mjs';
import { projectStop as callSupabaseStop } from '../api/supabase/project-stop.mjs';
import { isProtectedContainer } from '../lib/protected-installations.mjs';
import { underHostLock } from './verb-lock.mjs';
import { checkPortBlock } from './supabase-policy.mjs';
import { byCodeUnit } from '../lib/list.mjs';

const SUPABASE_CONFIG = path.join('supabase', 'config.toml');

const PORT_FIELD = Object.freeze({
  'api.port': 'api',
  'db.port': 'db',
  'db.shadow_port': 'shadow',
  'studio.port': 'studio',
  'inbucket.port': 'inbucket',
  'analytics.port': 'analytics',
  'db.pooler.port': 'pooler',
});

const schemaOf = (verb) => `starci/supabase-${verb}@1`;
const result = (verb, code, text, data = {}) => ({
  code,
  text: `starci supabase ${verb}: ${text}`,
  data: { schema: schemaOf(verb), ok: code === 0, ...data },
});

const policyRefusal = (text, refusals = [text]) => result('start', 2, `[SUPABASE_PORT_POLICY] ${text}`, {
  failureCode: 'SUPABASE_PORT_POLICY',
  refusals,
});

function withoutTomlComment(line) {
  const state = { quote: null, escaped: false };
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (consumeQuotedTomlCharacter(state, character)) continue;
    if (character === '"' || character === "'") { state.quote = character; continue; }
    if (character === '#') return line.slice(0, index);
  }
  return line;
}

function consumeQuotedTomlCharacter(state, character) {
  if (state.quote === '"' && state.escaped) { state.escaped = false; return true; }
  if (state.quote === '"' && character === '\\') { state.escaped = true; return true; }
  if (!state.quote) return false;
  if (character === state.quote) state.quote = null;
  return true;
}

function tomlScalar(text) {
  const value = text.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    try { return JSON.parse(value); } catch { return value.slice(1, -1); }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  if (/^[+-]?\d(?:_?\d)*$/u.test(value)) return Number(value.replaceAll('_', ''));
  return value;
}

/** Read only project_id and the seven port fields used by the local stack policy. */
export function parseSupabaseConfig(text) {
  let section = '';
  let projectId = null;
  const ports = {};
  for (const raw of String(text ?? '').replace(/^\uFEFF/u, '').split(/\r?\n/u)) {
    const line = withoutTomlComment(raw).trim();
    if (!line) continue;
    const table = /^\[([^\]]+)\]$/u.exec(line);
    if (table) { section = table[1].trim(); continue; }
    const assignment = /^([A-Za-z0-9_-]+)\s*=\s*(\S[^\n\r\u2028\u2029]*|[^\S\n\r\u2028\u2029])$/u.exec(line);
    if (!assignment) continue;
    const [, key, source] = assignment;
    const value = tomlScalar(source);
    if (!section && key === 'project_id') projectId = typeof value === 'string' ? value.trim() : String(value);
    const portName = PORT_FIELD[`${section}.${key}`];
    if (portName) ports[portName] = value;
  }
  return { projectId, ports };
}

/** Find the nearest app marker upward; hfs.json fixes the root even when its Supabase config is absent. */
export function findSupabaseAppRoot(cwd, { exists = fs.existsSync } = {}) {
  let directory = path.resolve(cwd ?? process.cwd());
  for (;;) {
    if (exists(path.join(directory, 'hfs.json')) || exists(path.join(directory, SUPABASE_CONFIG))) return directory;
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

function apiOf(deps) {
  return {
    exists: fs.existsSync,
    readFile: (file) => fs.readFileSync(file, 'utf8'),
    portListener,
    supabaseStart: callSupabaseStart,
    supabaseStop: callSupabaseStop,
    supabaseStatus: callSupabaseStatus,
    ...deps,
  };
}

function loadApp(cwd, api) {
  const root = findSupabaseAppRoot(cwd, { exists: api.exists });
  if (!root) return { error: 'no app root with hfs.json or supabase/config.toml was found upward from --cwd' };
  const configFile = path.join(root, SUPABASE_CONFIG);
  if (!api.exists(configFile)) return { error: 'the app root has no supabase/config.toml' };
  try {
    const parsed = parseSupabaseConfig(api.readFile(configFile, 'utf8'));
    return { root, ...parsed };
  } catch (error) {
    return { error: `supabase/config.toml could not be read: ${error?.message ?? error}` };
  }
}

const projectProblem = (projectId) => {
  if (!String(projectId ?? '').trim()) return 'project_id must be present in supabase/config.toml';
  if (isProtectedContainer(projectId)) return `project id ${projectId} is forbidden: never operate a protected stack`;
  return null;
};

const callOk = (call) => call?.ok === true
  || (!call?.error && (call?.status === 0 || call?.code === 0));

const holderName = (holder) => {
  if (holder === true) return 'an unknown process';
  const pid = Number.isInteger(holder?.pid) ? `pid ${holder.pid}` : 'a process';
  return holder?.commandLine ? `${pid} (${holder.commandLine})` : pid;
};

/** Start the configured project after policy and listener checks, serialized by the host verb lock. */
export async function supabaseStart(ctx, deps = {}) {
  const api = apiOf(deps);
  const app = loadApp(ctx?.cwd, api);
  if (app.error) return policyRefusal(app.error);
  const invalidProject = projectProblem(app.projectId);
  if (invalidProject) return policyRefusal(invalidProject);
  const policy = checkPortBlock(app.ports);
  if (!policy.ok) return policyRefusal(policy.refusals.join('; '), policy.refusals);

  for (const [name, port] of Object.entries(app.ports)) {
    const holder = await api.portListener(port);
    if (holder) return policyRefusal(`${name} port ${port} is already listened to by ${holderName(holder)}; every configured port must be free`);
  }

  const lock = deps.underHostLock ?? underHostLock;
  const locked = await lock({ role: ctx?.role ?? 'owner', purpose: 'supabase-start' }, async () => {
    let call;
    try { call = await api.supabaseStart(app.root, { env: ctx?.env ?? process.env }); }
    catch { return result('start', 1, 'the Supabase CLI failed to start the configured project', { project: app.projectId }); }
    if (!callOk(call)) return result('start', 1, 'the Supabase CLI failed to start the configured project', { project: app.projectId });
    return result('start', 0, `started project ${app.projectId}`, { project: app.projectId, ports: app.ports });
  }, deps);
  if (locked?.ok === false) {
    const owner = locked.owner ? ` by ${locked.owner}` : '';
    return result('start', 2, `host lock is held${owner}; the stack was not started`, { project: app.projectId });
  }
  const value = locked && Object.hasOwn(locked, 'value') ? locked.value : locked;
  if (!value || typeof value.code !== 'number') return result('start', 1, 'the host lock returned no start result', { project: app.projectId });
  return value.data ? { ...value, data: { ...value.data, locked: locked?.locked === true } } : value;
}

/** Stop exactly the project_id in the nearest app config; --all is never constructed. */
export async function supabaseStop(ctx, deps = {}) {
  const api = apiOf(deps);
  const app = loadApp(ctx?.cwd, api);
  if (app.error) return result('stop', 2, app.error);
  const invalidProject = projectProblem(app.projectId);
  if (invalidProject) return result('stop', 2, invalidProject);
  const noBackup = ctx?.args?.['no-backup'] === true;
  let call;
  try { call = await api.supabaseStop(app.root, app.projectId, { noBackup, env: ctx?.env ?? process.env }); }
  catch { return result('stop', 1, 'the Supabase CLI failed to stop the configured project', { project: app.projectId }); }
  if (!callOk(call)) return result('stop', 1, 'the Supabase CLI failed to stop the configured project', { project: app.projectId });
  return result('stop', 0, `stopped project ${app.projectId}`, { project: app.projectId, noBackup });
}

const jsonObject = (text) => {
  try {
    const value = JSON.parse(String(text ?? '').trim());
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
};

const urlValue = (payload, names) => {
  for (const name of names) if (typeof payload?.[name] === 'string') return payload[name];
  const urls = payload?.urls;
  for (const name of names) if (typeof urls?.[name] === 'string') return urls[name];
  return null;
};

const safeUrl = (value) => value == null ? null
  : String(value).replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@]+@/iu, '$1[redacted]@');

function keyNamesOf(value, names = new Set()) {
  if (!value || typeof value !== 'object') return [...names].sort(byCodeUnit);
  for (const [key, nested] of Object.entries(value)) {
    if (/(?:key|secret|token|password)/iu.test(key)) names.add(key);
    else if (nested && typeof nested === 'object') keyNamesOf(nested, names);
  }
  return [...names].sort(byCodeUnit);
}

const stoppedOutput = (call) => /not running|not started|stopped|no such container/iu
  .test(`${call?.stdout ?? ''}\n${call?.stderr ?? ''}`);

/** Read status JSON into a fixed, secret-free schema; a stopped project is a successful read. */
export async function supabaseStatus(ctx, deps = {}) {
  const api = apiOf(deps);
  const app = loadApp(ctx?.cwd, api);
  if (app.error) return result('status', 2, app.error);
  const invalidProject = projectProblem(app.projectId);
  if (invalidProject) return result('status', 2, invalidProject);
  let call;
  try { call = await api.supabaseStatus(app.root, { env: ctx?.env ?? process.env }); }
  catch { return result('status', 1, 'the Supabase CLI status read failed', { project: app.projectId }); }

  const payload = callOk(call) ? jsonObject(call.stdout) : null;
  if (!callOk(call) && !stoppedOutput(call)) return result('status', 1, 'the Supabase CLI status read failed', { project: app.projectId });
  if (callOk(call) && !payload) return result('status', 1, 'the Supabase CLI returned unreadable status JSON', { project: app.projectId });
  const running = payload ? payload.running !== false : false;
  const urls = {
    api: safeUrl(urlValue(payload, [`API${'_URL'}`, 'api_url', 'api'])),
    studio: safeUrl(urlValue(payload, [`STUDIO${'_URL'}`, 'studio_url', 'studio'])),
    db: safeUrl(urlValue(payload, [`DB${'_URL'}`, 'db_url', 'db'])),
  };
  const keyNames = keyNamesOf(payload);
  const data = { schema: schemaOf('status'), ok: true, running, project: app.projectId, ports: app.ports, urls, keyNames };
  const endpointLines = Object.entries(urls).filter(([, value]) => value).map(([name, value]) => `${name}: ${value}`);
  const keyLine = keyNames.length ? [`keys: ${keyNames.join(', ')}`] : [];
  return {
    code: 0,
    text: [`starci supabase status: project ${app.projectId} is ${running ? 'running' : 'stopped'}`, ...endpointLines, ...keyLine].join('\n'),
    data,
  };
}
