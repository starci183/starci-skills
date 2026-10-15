// R267/R268: immutable release references, recovery evidence and declared recurring CLI work.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTypescript } from '../../lib/package-at.mjs';
import { walkSqlAst, sqlParser, sqlCallArgument } from '../../lib/sql-ast.mjs';
import { isPlainObject as plain } from '../../../engine/plain-object.mjs';
import { found, readText } from './read.mjs';
import { stacksDeploymentContexts } from './stacks-runtime.mjs';

// PostgreSQL initializes asynchronously, while HFS finders must stay synchronous.
// Optional loading also lets dependency-free relocated development gates import this rule.
async function postgresParser() {
  try {
    const { default: parser } = await import('libpg-query');
    await parser.loadModule();
    return parser;
  } catch { return null; }
}

const pg = await postgresParser();
const HERE = path.dirname(fileURLToPath(import.meta.url));
let ts;

const DECLARATION = '.starcistacks/application-stacks.yaml';
const MAX_BYTES = 1024 * 1024;
const SOURCE = /^(?:be\/)?(?:src|apps)\/.*\.[cm]?[jt]s$/;
const TEST = /(?:\.(?:spec|test)|-spec)\.[cm]?[jt]s$|\/(?:tests|__tests__)\//;
const SECRET = /(?:^|\/)(?:secrets|\.claude|\.aws|\.codex)(?:\/|$)|(?:^|\/)\.env(?:\.|$)|\.(?:enc|pem|key|p12|pfx)$/i;
const CLI_ENTRY = /^(?:be\/)?dist\/apps\/cli\/[A-Za-z0-9_./-]+\.(?:js|mjs|cjs)$/;
const mapping = value => plain(value) ? value : {};
const present = value => typeof value === 'string' && Boolean(value.trim());
const issue = (code, at, message) => ({ code, at, message });
const scheduleIssue = (at, message) => issue('HFS_SCHEDULE_UNDECLARED', at, message);

function safeRelative(relative) {
  if (!present(relative) || SECRET.test(relative) || relative.includes(String.fromCodePoint(92))) return false;
  if (path.isAbsolute(relative) || /^[A-Za-z]:/.test(relative)) return false;
  return relative.split('/').every(part => part && part !== '.' && part !== '..');
}

function publicReference(repoRoot, files, relative) {
  if (!repoRoot || !safeRelative(relative)) return false;
  if (!files.includes(relative)) return false;
  const root = path.resolve(repoRoot), target = path.resolve(root, relative);
  try {
    let cursor = target;
    while (cursor !== root) {
      if (fs.lstatSync(cursor).isSymbolicLink()) return false;
      cursor = path.dirname(cursor);
    }
    const stat = fs.lstatSync(target);
    return stat.isFile() && stat.size > 0 && stat.size <= MAX_BYTES;
  } catch { return false; }
}

function releaseIssues({ environment, spec, repoRoot, files }) {
  const release = mapping(spec.release), at = `environments.${environment}.release`;
  const references = ['imagesLock', 'pointer', 'previous'];
  const assertions = release.healthAssertions;
  const valid = references.every(key => publicReference(repoRoot, files, release[key]))
    && Array.isArray(assertions) && assertions.length > 0 && assertions.every(present);
  return valid ? [] : [issue('STACKS_RELEASE_UNDECLARED', at,
    'Swarm release must declare tracked public imagesLock, pointer and previous records, and nonempty healthAssertions')];
}

function persistentVolume(volume) {
  if (plain(volume)) return volume.type === 'volume' && present(volume.source);
  if (!present(volume)) return false;
  const source = volume.split(':')[0];
  return volume.includes(':') && /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(source);
}

function stateful(component, service) {
  return component.role === 'stateful' || component.stateful === true
    || present(component.database) || present(component.database?.provider)
    || (Array.isArray(component.volumes) && component.volumes.length > 0)
    || (Array.isArray(service.volumes) && service.volumes.some(persistentVolume));
}

function recoveryComponents({ doc, spec, model }) {
  const components = mapping(doc.components), services = mapping(model?.services);
  const selected = new Set([...Object.keys(mapping(spec.components)), ...Object.keys(services)]);
  const required = new Set(Object.entries(mapping(doc.backing)).filter(([, entry]) => entry?.managed === true).map(([id]) => id));
  for (const id of selected) if (stateful(mapping(components[id]), mapping(services[id]))) required.add(id);
  return [...required];
}

function backupIssues(context) {
  const { environment, spec, repoRoot, files } = context;
  const backups = Array.isArray(spec.backup) ? spec.backup : [];
  const issues = [];
  for (const id of recoveryComponents(context)) {
    const at = `environments.${environment}.backup.${id}`;
    const records = backups.filter(record => record?.component === id);
    const complete = records.length === 1 && ['target', 'retention', 'owner'].every(key => present(records[0][key]));
    if (!complete) issues.push(issue('BACKUP_UNDECLARED', at, 'stateful components and managed backing must declare one backup target, retention and owner'));
    if (records.length === 1 && !publicReference(repoRoot, files, records[0].restoreProof))
      issues.push(issue('BACKUP_PROOF_MISSING', `${at}.restoreProof`, 'backup must reference a tracked, bounded public restore proof record'));
  }
  return issues;
}

/** Release and recovery declarations are mandatory for Swarm in either edition. */
export function releaseBackupIssues({ doc = {}, environment, spec = {}, model = {}, repoRoot, files = [] }) {
  if (spec.runtime !== 'docker-swarm') return [];
  const context = { doc, environment, spec, model, repoRoot, files };
  return [...releaseIssues(context), ...backupIssues(context)];
}

function commandWords(value) {
  if (Array.isArray(value)) return value.every(present) ? value : [];
  if (!present(value) || /[;&|<>`\r\n]/.test(value) || value.includes('$(')) return [];
  return value.trim().split(/\s+/).map(word => word.replace(/^['"]|['"]$/g, ''));
}

function cliCommand(value) {
  const words = commandWords(value);
  if (words.length < 3 || words[0] !== 'node' || !CLI_ENTRY.test(words[1]) || words[1].split('/').includes('..')) return null;
  if (!/^[a-z][A-Za-z0-9:_-]*$/.test(words[2])) return null;
  return [words[1].replace(/^be\//, ''), ...words.slice(2)].join(' ');
}

function jobIssues(doc) {
  return Object.entries(mapping(doc.jobs)).flatMap(([id, job]) =>
    present(job?.schedule) && cliCommand(job?.command) ? [] : [scheduleIssue(`jobs.${id}`, 'recurring jobs must declare a nonempty schedule and an app CLI command')]);
}

function cadenceMatches(declared, cadence) {
  if (cadence === null) return true;
  const value = String(cadence);
  return declared === value || declared === `every:${value}` || declared === `${value}ms`;
}

function matchingJob(doc, observation) {
  const jobs = Object.entries(mapping(doc.jobs));
  const candidates = jobs.filter(([id, job]) => id === observation.id || (observation.component && job?.component === observation.id));
  return candidates.find(([, job]) => present(job?.schedule) && cliCommand(job.command)
    && (observation.id || observation.cadence !== null) && cadenceMatches(job.schedule, observation.cadence))?.[1] ?? null;
}

function unwrap(node) {
  while (node && (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node))) node = node.expression;
  return node;
}

function literal(node, bindings, seen = new Set()) {
  node = unwrap(node);
  if (!node) return null;
  if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return node.text;
  if (ts.isIdentifier(node) && !seen.has(node.text)) {
    seen.add(node.text);
    return literal(bindings.get(node.text), bindings, seen);
  }
  if (ts.isPropertyAccessExpression(node) && node.expression.getText() === 'CronExpression') return node.getText();
  return null;
}

function property(node, name) {
  node = unwrap(node);
  if (!node || !ts.isObjectLiteralExpression(node)) return null;
  const entry = node.properties.find(item => item.name?.getText().replaceAll('"', '').replaceAll("'", '') === name);
  return entry?.initializer ?? null;
}

function sourceBindings(source) {
  const bindings = new Map(), aliases = new Map([['Cron', 'Cron'], ['Interval', 'Interval']]);
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) bindings.set(node.name.text, node.initializer);
    ts.forEachChild(node, visit);
  };
  visit(source);
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== '@nestjs/schedule') continue;
    for (const item of statement.importClause?.namedBindings?.elements ?? []) aliases.set(item.name.text, (item.propertyName ?? item.name).text);
  }
  return { bindings, aliases };
}

function callObservation(node, facts) {
  if (!ts.isCallExpression(node)) return null;
  const name = node.expression.getText().split('.').at(-1), kind = facts.aliases.get(name) ?? name;
  if (kind === 'Cron' || kind === 'Interval') {
    const member = ts.isDecorator(node.parent) ? node.parent.parent.name?.getText() : null;
    return { id: literal(property(node.arguments[1], 'name'), facts.bindings) ?? member,
      cadence: literal(node.arguments[0], facts.bindings), node };
  }
  if (name === 'setInterval') return {
    id: node.arguments[0] && ts.isIdentifier(node.arguments[0]) ? node.arguments[0].text : null,
    cadence: literal(node.arguments[1], facts.bindings), node,
  };
  if (name !== 'upsertJobScheduler' && name !== 'addJobScheduler') return null;
  return { id: literal(node.arguments[0], facts.bindings),
    cadence: literal(property(node.arguments[1], 'pattern') ?? property(node.arguments[1], 'every'), facts.bindings), node };
}

function objectObservation(node, facts) {
  if (!ts.isObjectLiteralExpression(node)) return null;
  const id = property(node, 'id'), cadence = property(node, 'everyMs') ?? property(node, 'pattern');
  if (!id || !cadence) return null;
  return { id: literal(id, facts.bindings), cadence: literal(cadence, facts.bindings), node };
}

function sourceObservationIssues(doc, file, source, facts) {
  const issues = [];
  const visit = node => {
    const observation = callObservation(node, facts) ?? objectObservation(node, facts);
    const forwarding = file.includes('/modules/platform/') && observation?.id === null && observation.cadence === null;
    if (observation && !forwarding && !matchingJob(doc, observation)) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      issues.push(scheduleIssue(`${file}:${line}`, 'recurring source must match a manifest jobs entry with its schedule and an app CLI command'));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return issues;
}

const walkSql = (tree, visit) => walkSqlAst(tree, visit, true);
const parseSql = sqlParser(pg);

function sqlArgument(call, position, names) {
  const value = sqlCallArgument(call, position, names);
  return value?.A_Const?.sval?.sval ?? value?.TypeCast?.arg?.A_Const?.sval?.sval ?? null;
}

function executableExpression(expression) {
  let query = expression.query;
  if (expression.parseMode === 0) return query;
  if (expression.parseMode >= 3) {
    const assignment = query.indexOf(':=');
    query = assignment < 0 ? query.slice(query.indexOf('=') + 1) : query.slice(assignment + 2);
  }
  return `SELECT ${query}`;
}

function doSqlObservations(statement, file) {
  const body = statement.args?.find(arg => arg.DefElem?.defname === 'as')?.DefElem?.arg?.String?.sval;
  if (!present(body)) return [];
  let tree;
  try { tree = pg.parsePlPgSQLSync("DO '" + body.replaceAll("'", "''") + "';"); }
  catch { return [{ id: null, cadence: null, at: file }]; }
  const observations = [];
  walkSql(tree, value => {
    const expression = value.PLpgSQL_expr;
    if (present(expression?.query)) observations.push(...sqlObservations(executableExpression(expression), file));
  });
  return observations;
}

function sqlObservations(text, file) {
  const tree = parseSql(text);
  if (!tree) return [{ id: null, cadence: null, at: file }];
  const observations = [];
  walkSql(tree, value => {
    if (value.DoStmt) observations.push(...doSqlObservations(value.DoStmt, file));
    const call = value.FuncCall;
    if (!call) return;
    const name = (call.funcname ?? []).map(part => part.String?.sval).join('.');
    if (name === 'cron.unschedule') observations.push({ remove: sqlArgument(call, 0, ['job_name']) });
    if (name === 'cron.schedule' || name === 'cron.schedule_in_database') observations.push({
      id: sqlArgument(call, 0, ['job_name']), cadence: sqlArgument(call, 1, ['schedule']),
      at: `${file}:${text.slice(0, call.location).split('\n').length}`,
    });
  });
  return observations;
}

function sourceSqlObservations(source, file) {
  const observations = [];
  const visit = node => {
    if (ts.isCallExpression(node) && /(?:^|\.)(?:query|execute)$/.test(node.expression.getText())) {
      const argument = unwrap(node.arguments[0]);
      const text = sqlTemplateText(argument);
      if (text !== null) observations.push(...sqlObservations(text, file));
    }
    if (ts.isTaggedTemplateExpression(node) && /(?:^|\.)sql$/.test(node.tag.getText()))
      observations.push(...sqlObservations(sqlTemplateText(node.template), file));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return observations;
}

function sqlTemplateText(node) {
  if (!node) return null;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (!ts.isTemplateExpression(node)) return null;
  return node.head.text + node.templateSpans.map(span => `NULL${span.literal.text}`).join('');
}

function recurringObservations({ doc, repoRoot, files, file, issues }) {
  const sql = file.startsWith('supabase/migrations/') && file.endsWith('.sql') && !file.includes('/_archive/');
  const sourceFile = SOURCE.test(file) && !TEST.test(file);
  if ((!sql && !sourceFile) || !publicReference(repoRoot, files, file)) return [];
  const text = readText(repoRoot, file);
  if (text === null) return [];
  if (sql) return sqlObservations(text, file);
  ts ??= loadTypescript(repoRoot, HERE);
  if (!ts) {
    issues.push(scheduleIssue(file, 'TypeScript is required to inspect recurring application work'));
    return [];
  }
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  issues.push(...sourceObservationIssues(doc, file, source, sourceBindings(source)));
  return sourceSqlObservations(source, file);
}

function recurringSourceIssues({ doc, repoRoot, files }) {
  const issues = [], cron = new Map();
  const paths = [...new Set(files)].sort((left, right) => left.localeCompare(right));
  for (const file of paths) {
    const observations = recurringObservations({ doc, repoRoot, files, file, issues });
    for (const observation of observations) {
      if ('remove' in observation) {
        if (observation.remove) cron.delete(observation.remove);
      } else cron.set(observation.id ?? observation.at, observation);
    }
  }
  for (const observation of cron.values()) if (!matchingJob(doc, observation))
    issues.push(scheduleIssue(observation.at, 'pg_cron job must match a manifest jobs entry with its schedule and an app CLI command'));
  return issues;
}

function scheduledComponentIssues({ doc, environment, spec, model }) {
  const issues = [], components = mapping(doc.components), services = mapping(model?.services);
  const selected = new Set([...Object.keys(mapping(spec.components)), ...Object.keys(services)]);
  for (const id of selected) {
    const component = mapping(components[id]), service = mapping(services[id]);
    const replicated = component.mode === 'replicated-job' || service.deploy?.mode === 'replicated-job';
    if (!replicated && component.schedule === undefined) continue;
    const job = matchingJob(doc, { id, component: true, cadence: component.schedule ?? null });
    const command = cliCommand(service.command);
    const commandMatches = !replicated || (command && cliCommand(job?.command) === command);
    if (!job || (job.component !== undefined && job.component !== id) || !commandMatches)
      issues.push(scheduleIssue(`environments.${environment}.components.${id}`, 'scheduled component must match a manifest job schedule; replicated-job must execute its declared app CLI command'));
  }
  return issues;
}

/** Recurring sources and rendered replicated-jobs name one manifest job and CLI action. */
export function scheduleIssues({ doc = {}, environment, spec = {}, model = {}, repoRoot, files = [], scanSources = true }) {
  return [...jobIssues(doc), ...(scanSources ? recurringSourceIssues({ doc, repoRoot, files }) : []),
    ...scheduledComponentIssues({ doc, environment, spec, model })];
}

function findingOf(checked) {
  const match = /^(.*\.(?:sql|[cm]?[jt]s)):(\d+)$/.exec(checked.at);
  const sourceFile = /\.(?:sql|[cm]?[jt]s)$/.test(checked.at) ? checked.at : null;
  const file = match?.[1] ?? sourceFile ?? DECLARATION;
  return found(checked.code, file, `${file}: ${checked.at}: ${checked.message}`);
}

/** Both editions receive real findings when a declared Swarm model cannot be judged. */
export function stacksReleaseFindings(context) {
  if (context.isRoot === false || (context.repo?.profile && context.repo.profile !== 'app')) return [];
  const { doc, deployments, files } = stacksDeploymentContexts(context);
  const findings = scheduleIssues({ doc, repoRoot: context.repoRoot, files }).map(findingOf);
  for (const deployment of deployments) {
    const input = { ...deployment, doc, files, repoRoot: context.repoRoot };
    if (deployment.unavailable) findings.push(found('STACKS_MODEL_UNAVAILABLE', deployment.file,
      `${deployment.file}: environments.${deployment.environment}: a tracked rendered deployment model is required to judge Swarm safety`));
    findings.push(...releaseBackupIssues(input).map(findingOf), ...scheduledComponentIssues(input).map(findingOf));
  }
  return findings;
}
