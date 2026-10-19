// R250: host scheduling and application logic do not belong in deployment sources; compose mutations stay in dev.
import { parseWorkflow } from '../runtime-rules/workflow-source.mjs';
import { words } from '../../lib/dockerfile.mjs';
import { found, readText } from './read.mjs';

const WORKFLOW = /(?:^|\/)\.github\/workflows\/[^/]+\.ya?ml$/;
const DEPLOY = /(?:^|\/)deploy\//;
const SCRIPT = /(?:^|\/)scripts\//;
const COMPOSE = /(?:^|\/)(?:docker-)?compose(?:[.-][^/]*)?\.ya?ml$/;
const DOCKERFILE = /(?:^|\/)Dockerfile(?:\.[^/]*)?$/;
const CREDENTIAL_FILE = /(?:(?:^|\/)(?:secrets?\.env(?:\.[^/]*)?|\.env(?:\.[^/]*)?|secrets\/))|(?:\.enc$)/i;
const HOST_CRON = /\b(?:crontab|anacron|crond|supercronic)\b|\/etc\/cron(?:\b|[./])|\bcron\.d\b|\/var\/spool\/cron\b|@(?:reboot|yearly|annually|monthly|weekly|daily|midnight|hourly)\b|\b[\w.@-]+\.timer\b|\bOn(?:Calendar|BootSec|UnitActiveSec|ActiveSec)\s*=|(?:^|[\s;|&"'])at\s+(?:(?:-[a-z]+\s+)*)((?:-[ft]\b)|now\b|tomorrow\b|\d{1,2}:\d{2}\b|midnight\b|noon\b)/im;
const HOST_CRON_PATH = /(?:^|\/)(?:crontab(?:$|\/)|cron\.d(?:\/|$)|[^/]+\.(?:timer|crontab)$)/;
const CRON_NUMERIC_FIELD = /^[\d*,/-]+$/;
const CRON_NAMED_FIELD = /^[\w*,/-]+$/;
const CRON_CONTAINER = /\bimage\s*:\s*["']?(?:[^\s"']*\/)?(?:cron|crond|supercronic|ofelia)(?=[:@\s"']|$)|\b(?:command|entrypoint)\s*:[^\n]*\b(?:cron|crond|supercronic)\b/i;
const SLEEP_LOOP = /\b(?:while\s+(?:true|:|\[\s*1\s*\])|for\s*\(\(\s*;\s*;\s*\)\))\s*[;\n][\s\S]{0,4000}?\bsleep\s+/i;
const INLINE_NODE = /\bnode\b[^\n;&|]*?\s(?:-(?:e|p|pe)\b|--(?:eval|print)(?:\s|=))/;
const INLINE_SQL_ACTION = /\b(?:insert\s+into|update\s+[\w."']+\s+set|delete\s+from|create\s+(?:table|function|view)|alter\s+table|truncate\s+(?:table\s+)?[\w."'])\b/i;
const REMOTE_SHELL = /\b(?:curl|wget)\b[^|\n]*\|\s*(?:sudo\s+)?(?:ba|da|z)?sh\b/i;
const COMPOSE_COMMAND = /\bdocker(?:\s+(?:--(?:context|host)(?:\s+|=)\S+|-H\s+\S+))*\s+compose\b[^\n;&|]*|\bdocker-compose\b[^\n;&|]*/g;
const COMPOSE_OPTIONS = new Set(['-f', '--file', '-p', '--project-name', '--project-directory', '--env-file', '--profile', '--parallel', '--ansi', '--progress']);
const DEV = /(?:^|[\s/._="'-])(?:dev|development|local)(?=$|[\s/._"'-])/i;
const NON_DEV = /(?:^|[\s/._="'-])(?:prod|production|staging|stage|vps|preview)(?=$|[\s/._"'-])/i;
const WORKFLOW_ENV_NAMES = ['DEPLOY_ENV', 'NODE_ENV', 'ENVIRONMENT', 'STARCI_ENV'];

/** Comments carry no executable scheduling; preserve strings so embedded SSH commands remain visible. */
function sourceText(text) {
  return text.split('\n').map((line) => {
    const trimmed = line.trimStart();
    return trimmed.startsWith('#') || trimmed.startsWith('//') ? '' : line;
  }).join('\n').replaceAll(/\\\r?\n\s*/g, ' ');
}

function cronTable(text) {
  return text.split('\n').some((line) => {
    const fields = line.trimStart().replace(/^["']/, '').trimEnd().split(/\s+/);
    return fields.length >= 6
      && fields.slice(0, 3).every((field) => CRON_NUMERIC_FIELD.test(field))
      && fields.slice(3, 5).every((field) => CRON_NAMED_FIELD.test(field));
  });
}

function firstWordOffsets(text) {
  const offsets = new Set();
  let offset = 0;
  for (const line of text.split(/[\r\n\u2028\u2029]/)) {
    offsets.add(offset + line.length - line.trimStart().length);
    offset += line.length + 1;
  }
  return offsets;
}

function inlineSql(text) {
  if (INLINE_SQL_ACTION.test(text)) return true;
  const offsets = firstWordOffsets(text);
  for (const match of text.matchAll(/select/gi)) {
    const preceding = text[match.index - 1];
    const startsSql = offsets.has(match.index) || preceding === '"' || preceding === "'";
    if (startsSql && /^\s+[^\n;]/.test(text.slice(match.index + match[0].length))) return true;
  }
  return false;
}

function deploymentSource(file) {
  if (CREDENTIAL_FILE.test(file) || /\.(?:md|png|jpe?g|svg|pdf|zip|gz)$/i.test(file)) return false;
  return DEPLOY.test(file) || SCRIPT.test(file) || WORKFLOW.test(file) || COMPOSE.test(file) || DOCKERFILE.test(file);
}

function stackEnvironments(text) {
  return [...text.matchAll(/\.starcistacks\/([^/\s"']+)\//g)].map((match) => match[1]);
}

function composeTargets(command) {
  const parts = words(command);
  const targets = [];
  for (let i = 0; i < parts.length; i += 1) {
    if (['-f', '--file', '--env-file', '--project-directory'].includes(parts[i])) {
      i += 1;
      targets.push(parts[i] ?? '');
    }
    else if (/^--(?:file|env-file|project-directory)=/.test(parts[i])) targets.push(parts[i].slice(parts[i].indexOf('=') + 1));
    else if (/^-f.+/.test(parts[i])) targets.push(parts[i].slice(2));
  }
  return targets;
}

function targetsNonDev(command, { environment, directory, remote }) {
  if (remote || /--context(?:=|\s+)(?:prod(?:uction)?|staging|vps)\b|--host(?:=|\s+)ssh:\/\//i.test(command)) return true;
  const targets = composeTargets(command);
  if (targets.length) return targets.some((target) => {
    const environments = stackEnvironments(target);
    return environments.length ? environments.some((name) => !/^(?:dev|development|local)$/i.test(name)) : !DEV.test(target) || NON_DEV.test(target);
  });
  if (NON_DEV.test(environment) || NON_DEV.test(directory)) return true;
  if (DEV.test(environment) || DEV.test(directory)) return false;
  return true;
}

function composeMutation(command) {
  const parts = words(command);
  const composeAt = parts.findIndex((part) => part === 'compose' || part === 'docker-compose');
  const arguments_ = parts.slice(composeAt + 1);
  for (let i = 0; i < arguments_.length; i += 1) {
    const argument = arguments_[i];
    if (COMPOSE_OPTIONS.has(argument)) { i += 1; continue; }
    if (argument.startsWith('-')) continue;
    return ['up', 'down', 'pull'].includes(argument);
  }
  return false;
}

/** Job-local context prevents a production job from changing how a separate dev compose step is judged. */
function workflowCommands(doc) {
  const entries = [];
  for (const job of Object.values(doc?.jobs ?? {})) {
    const environment = typeof job?.environment === 'string' ? job.environment : job?.environment?.name ?? '';
    const environmentNames = WORKFLOW_ENV_NAMES.map((key) => job?.env?.[key] ?? doc?.env?.[key] ?? '').join(' ');
    const context = { environment: `${environment} ${environmentNames}` };
    for (const step of Array.isArray(job?.steps) ? job.steps : []) {
      const directory = step?.['working-directory'] ?? job?.defaults?.run?.['working-directory'] ?? doc?.defaults?.run?.['working-directory'] ?? '';
      const stepEnvironments = WORKFLOW_ENV_NAMES.map((key) => step?.env?.[key] ?? '').join(' ');
      for (const source of [step?.run, step?.with?.script]) {
        if (typeof source === 'string') entries.push({ source: sourceText(source), context: { ...context, environment: `${context.environment} ${stepEnvironments}`, directory, remote: Boolean(step?.with?.host && !/^(?:localhost|127\.0\.0\.1)$/.test(step.with.host)) } });
      }
    }
  }
  return entries;
}

function composeOnVps(file, text, doc) {
  let entries = doc ? workflowCommands(doc) : [{ source: text, context: { environment: '', directory: '' } }];
  if (file.endsWith('/package.json')) {
    try { entries = Object.values(JSON.parse(text)?.scripts ?? {}).filter((command) => typeof command === 'string').map((source) => ({ source, context: { environment: '', directory: '' } })); } catch { /* Invalid JSON is judged by its own rule. */ }
  }
  return entries.some(({ source, context }) => [...source.matchAll(COMPOSE_COMMAND)].some((match) => {
    const before = source.slice(0, match.index);
    const linePrefix = before.slice(before.lastIndexOf('\n') + 1);
    const directory = workingDirectory(before) ?? context.directory;
    const remote = context.remote || (/\bssh\b/.test(linePrefix) && !/\b(?:localhost|127\.0\.0\.1)\b/.test(linePrefix));
    return composeMutation(match[0]) && targetsNonDev(match[0], { ...context, directory, remote });
  }));
}

function workingDirectory(source) {
  let directory;
  for (const command of source.split(/[\n;&]/)) {
    const match = /^cd\s+([\w./-]+)/.exec(command.trimStart());
    if (match) directory = match[1];
  }
  return directory;
}

function workflowSchedule(doc, text) {
  return Boolean(doc?.on && typeof doc.on === 'object' && Object.hasOwn(doc.on, 'schedule'))
    || (!doc && text.split('\n').some((line) => /^schedule\s*:/.test(line.trimStart())));
}

function deploymentLogic(file, text) {
  return DEPLOY.test(file) && /\.(?:sh|bash)$/.test(file)
    && (INLINE_NODE.test(text) || /\bpsql\b/.test(text) || inlineSql(text) || REMOTE_SHELL.test(text));
}

function sourceFindings(file, text, doc) {
  const findings = [];
  const cronContainer = CRON_CONTAINER.test(text);
  const host = HOST_CRON.test(text) || HOST_CRON_PATH.test(file) || cronTable(text) || cronContainer || /\b(?:service\s+cron|cron\s+-[a-z]|cron\s*$)/im.test(text);
  if (host) findings.push(found('HFS_HOST_CRON', file, 'Host cron, systemd timers and at jobs are forbidden; use an app-owned scheduler or a declared replicated-job'));
  if ((WORKFLOW.test(file) && workflowSchedule(doc, text)) || (DEPLOY.test(file) && host) || cronContainer || SLEEP_LOOP.test(text)) {
    findings.push(found('HFS_DEPLOY_SCHEDULER', file, 'Deployment sources must not own recurring schedules; move scheduled work into the app and declare its job'));
  }
  if (deploymentLogic(file, text)) {
    findings.push(found('HFS_DEPLOY_NO_LOGIC', file, 'Deployment shell scripts must delegate to docker, starci or the built cli app; move inline application or database logic into the cli app'));
  }
  if (composeOnVps(file, text, doc)) findings.push(found('HFS_DEPLOY_COMPOSE_ON_VPS', file, 'Compose up, down and pull are dev-only; deploy a non-dev environment through its declared Swarm or Kubernetes runtime'));
  return findings;
}

/** Findings are names and paths only: deployment source snippets and credential values are never reported. */
export function deployScanFindings({ repoRoot, files, all, repo, isRoot, inScope = () => true }) {
  if (repo?.kind !== 'app' || !['lite', 'full'].includes(repo.edition) || isRoot === false) return [];
  const findings = [];
  for (const file of new Set(all ?? files)) {
    if (!inScope(file) || !deploymentSource(file)) continue;
    const raw = readText(repoRoot, file);
    if (raw === null) continue;
    const text = sourceText(raw);
    const doc = WORKFLOW.test(file) ? parseWorkflow(raw) : null;
    findings.push(...sourceFindings(file, text, doc));
  }
  return findings;
}
