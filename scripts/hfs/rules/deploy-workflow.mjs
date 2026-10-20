// R251: product workflow custody, immutable dependencies and release-only triggers, in both editions.
import { parseWorkflow } from '../runtime-rules/workflow-source.mjs';
import { found } from './read.mjs';
import { appWorkflowFindings } from './app-workflow-findings.mjs';
import { isPlainObject as record } from '../../../engine/plain-object.mjs';
import { workflowEventOptions } from '../../lib/workflow-events.mjs';

const DEPLOY = 'HFS_DEPLOY_WORKFLOW';
const TOOL = 'HFS_CI_TOOL_INSTALL';
const TRIGGER = 'HFS_APP_WORKFLOW_TRIGGER';
// Only the age identity and SSH transport credentials belong in the CI secret store.
const CI_SECRET_ENV_NAMES = new Set(['SOPS_AGE_KEY', 'SSH_KEY', 'SSH_PRIVATE_KEY', 'SSH_KNOWN_HOSTS', 'VPS_SSH_KEY', 'VPS_SSH_PRIVATE_KEY', 'VPS_KNOWN_HOSTS', 'VPS_SSH_KNOWN_HOSTS', 'DEPLOY_SSH_KEY', 'DEPLOY_SSH_PRIVATE_KEY', 'DEPLOY_KNOWN_HOSTS', 'DEPLOY_SSH_KNOWN_HOSTS']);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
function executable(script) {
  let result = '';
  let quote = '';
  for (let index = 0; index < script.length; index++) {
    const character = script[index];
    if (character === '\\' && quote !== "'") { result += character + (script[++index] ?? ''); continue; }
    if (!quote && character === '#' && (index === 0 || /[\s;&|()]/.test(script[index - 1]))) {
      while (index < script.length && script[index] !== '\n') index++;
      result += '\n';
      continue;
    }
    if (character === quote) quote = '';
    else if (!quote && (character === "'" || character === '"')) quote = character;
    result += character;
  }
  return result.replace(/\\\r?\n/g, ' ');
}

function commands(script) {
  const result = [];
  let quote = '';
  let start = 0;
  for (let index = 0; index < script.length; index++) {
    const character = script[index];
    if (character === '\\' && quote !== "'") { index++; continue; }
    if (character === quote) quote = '';
    else if (!quote && (character === "'" || character === '"')) quote = character;
    else if (!quote && /[\n;&|]/.test(character)) { result.push({ text: script.slice(start, index).trim(), start, end: index, separator: character }); start = index + 1; }
  }
  result.push({ text: script.slice(start).trim(), start });
  return result.filter((command) => command.text);
}

const commandBody = (command) => command.replace(/^(?:(?:sudo|env)\s+|[A-Za-z_]\w*=[^\s]+\s+)*/, '');

function entries(value) {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, member]) => [{ key, value: member }, ...entries(member)]);
}

const strings = (value) => entries(value).filter((entry) => typeof entry.value === 'string').map((entry) => entry.value);
const activeSteps = (job) => (Array.isArray(job.steps) ? job.steps : []).filter((step) => record(step) && step.if !== false && step.if !== 'false' && !/^\$\{\{\s*false\s*\}\}$/.test(String(step.if ?? '')));
const scripts = (job) => activeSteps(job).flatMap((step) => [step.run, step.with?.script].filter(nonempty).map(executable));
const validEnvironment = (value) => nonempty(value) || (record(value) && nonempty(value.name));
const validPermissions = (value) => record(value) || value === 'read-all' || value === 'write-all';
const validConcurrency = (value) => nonempty(value) || (record(value) && nonempty(value.group));
const deployName = (value) => !/authorize[\s_.-]+deploy[\s_.-]+key/i.test(value) && /(?:^|[\s/_.-])deploy(?:[\s/_.-]|$)/i.test(value);
const materializeCommand = (script) => commands(script).some(({ text }) => /^starci\s+app\s+secret\s+materialize\b/.test(commandBody(text)));
const DEPLOYMENT_COMMANDS = [
  /^starci\s+(?:app\s+)?(?:deploy|secret\s+materialize)\b/,
  /^docker\s+stack\s+deploy\b/,
  /^(?:ba?sh\s+)?(?:\.\/)?deploy\//,
  /^(?:ba?sh\s+)?(?:\.\/)?(?:scripts\/)?[\w.-]*deploy[\w.-]*\.sh\b/,
  /^npm\s+run\s+deploy(?=[:\s]|$)/,
];
const deploymentCommand = (script) => commands(script).some(({ text }) => {
  const body = commandBody(text);
  return DEPLOYMENT_COMMANDS.some((pattern) => pattern.test(body));
});

function hasAgeIdentity(job, doc) {
  const steps = activeSteps(job);
  if ([doc.env, job.env, ...steps.map((step) => step.env)].some((env) => record(env) && nonempty(env.SOPS_AGE_KEY))) return true;
  const reference = /\$\{\{\s*secrets\s*(?:\.\s*SOPS_AGE_KEY|\[\s*(['"])SOPS_AGE_KEY\1\s*\])/;
  return steps.some((step) => strings(step.with).some((value) => reference.test(value)) || (typeof step.run === 'string' && reference.test(executable(step.run))));
}

/** The release candidate branches (OWNER RULING candidate-ci, 2026-10-18): `starci app release push` waits for the ci.yml run of the release sha there. */
const CANDIDATE_BRANCHES = 'release/candidate-*';
const pushFilterValid = (options) => record(options) && Object.keys(options).length > 0 && Object.keys(options).every((key) => key === 'tags' || key === 'branches')
  && (options.tags === undefined || (Array.isArray(options.tags) && options.tags.length === 1 && options.tags[0] === 'v*'))
  && (options.branches === undefined || (Array.isArray(options.branches) && options.branches.length === 1 && options.branches[0] === CANDIDATE_BRANCHES));

function triggerFindings(doc, refuse, file = '') {
  const on = workflowEventOptions(doc.on);
  if (!record(on) || !Object.keys(on).length) return [refuse(TRIGGER, 'declare release tags [v*] and/or workflow_dispatch')];
  const findings = [];
  if (/(^|\/)ci\.ya?ml$/.test(file) && !(record(on.push) && Array.isArray(on.push.branches) && on.push.branches.includes(CANDIDATE_BRANCHES))) {
    findings.push(refuse(TRIGGER, `the release CI must run on push of branches ['${CANDIDATE_BRANCHES}']: starci app release push waits for that run (starci app sync renders it)`));
  }
  for (const [event, options] of Object.entries(on)) {
    if (event === 'workflow_dispatch') continue;
    if (event !== 'push') {
      findings.push(refuse(TRIGGER, `trigger ${event} is forbidden; app CI starts only on release tags [v*], the release candidate branches or workflow_dispatch`));
      continue;
    }
    if (!pushFilterValid(options)) {
      findings.push(refuse(TRIGGER, `push may contain only tags: [v*] and branches: ['${CANDIDATE_BRANCHES}']; other branch and path filters are forbidden`));
    }
  }
  return findings;
}

function secretProblems(doc) {
  const problems = [];
  if (entries(doc).some(({ key, value }) => key === 'secrets' && value === 'inherit')) problems.push('inherited secrets are forbidden');
  for (const value of strings(doc)) {
    for (const expression of value.matchAll(/\$\{\{([\s\S]*?)\}\}/g)) {
      const text = expression[1];
      const refs = [...text.matchAll(/\bsecrets\s*(?:\.\s*([A-Za-z_]\w*)|\[\s*(['"])([^'"]+)\2\s*\])/g)];
      for (const ref of refs) if (!CI_SECRET_ENV_NAMES.has(ref[1] ?? ref[3])) problems.push('a secrets reference is outside the age-key/SSH transport allowlist');
      if (/\bsecrets\b/.test(text.replace(/\bsecrets\s*(?:\.\s*[A-Za-z_]\w*|\[\s*(['"])[^'"]+\1\s*\])/g, ''))) problems.push('dynamic or bulk secrets access is forbidden');
    }
  }
  return [...new Set(problems)];
}

function dotenvTarget(script, start) {
  let index = start;
  while (index < script.length && /\s/.test(script[index])) index++;
  if (script[index] === '"' || script[index] === "'") index++;
  const from = index;
  while (index < script.length && !/[\s"';|<>]/.test(script[index])) index++;
  if (index < script.length && !/[\s"';|]/.test(script[index])) return false;
  const target = script.slice(from, index);
  const name = target.slice(target.lastIndexOf('/') + 1);
  if (name.startsWith('.env')) return /^[.\w-]*$/.test(name.slice(4));
  return name.endsWith('.env') && /^[\w.-]+$/.test(name.slice(0, -4));
}

function scriptWritesDotenv(value) {
  const script = executable(value);
  for (const match of script.matchAll(/>{1,2}|\btee\s+(?:-a\s+)?/g)) {
    if (dotenvTarget(script, match.index + match[0].length)) return true;
  }
  return false;
}

function writesDotenv(doc) {
  return entries(doc).some(({ key, value }) => key === 'env_file' || key === 'env-file' || (['run', 'script'].includes(key) && typeof value === 'string' && scriptWritesDotenv(value)));
}

function deploymentJobs(doc, file) {
  const jobs = record(doc.jobs) ? Object.entries(doc.jobs).filter(([, job]) => record(job)) : [];
  const identified = jobs.filter(([name, job]) => deployName(name) || deployName(String(job.name ?? '')) || scripts(job).some(deploymentCommand) || (typeof job.uses === 'string' && deployName(job.uses)));
  if (identified.length) return identified;
  if (deployName(file) || deployName(String(doc.name ?? ''))) return jobs;
  return [];
}

function deploymentJobFindings(name, job, doc, refuse) {
  const findings = [];
  if (!validEnvironment(job.environment)) findings.push(refuse(DEPLOY, `job ${name} must declare its protected environment`));
  if (!validPermissions(job.permissions ?? doc.permissions)) findings.push(refuse(DEPLOY, `job ${name} must declare permissions at job or workflow scope`));
  if (!validConcurrency(job.concurrency ?? doc.concurrency)) findings.push(refuse(DEPLOY, `job ${name} must declare concurrency at job or workflow scope`));
  if (!hasAgeIdentity(job, doc) && !scripts(job).some(materializeCommand)) findings.push(refuse(DEPLOY, `job ${name} must inject SOPS_AGE_KEY or run starci app secret materialize`));
  return findings;
}

function deploymentFindings(doc, file, refuse) {
  const deployment = deploymentJobs(doc, file);
  const named = deployName(file) || deployName(String(doc.name ?? ''));
  if (!deployment.length && !named) return [];
  const findings = [];
  if (!deployment.length) findings.push(refuse(DEPLOY, 'the deploy workflow must declare a deployment job'));
  for (const [name, job] of deployment) findings.push(...deploymentJobFindings(name, job, doc, refuse));
  for (const problem of secretProblems(doc)) findings.push(refuse(DEPLOY, problem));
  if (writesDotenv(doc)) findings.push(refuse(DEPLOY, 'deploy workflows must never write dotenv files or use env_file blobs; materialize sealed custody'));
  return findings;
}

// A version label alone is not an integrity pin. The immutable reference or verified artifact must belong to this install.
function verifiedArtifact(artifact, prior) {
  if (!/^\.\/[\w./-]+\.(?:tgz|tar\.gz|whl)$/.test(artifact)) return false;
  return prior.split(/\r?\n/).some((line) => {
    const checksum = line.trim().match(/^echo\s+(['"])([a-f\d]{64})\s+\*?(\S+)\1\s*\|\s*sha256sum\s+(?:--check|-c)\s+-\s*(?:$|&&)/i);
    return checksum && checksum[3].replace(/^\.\//, '') === artifact.slice(2) && !line.includes('||');
  });
}

function pinnedInstall(command, prior) {
  if (/^(?:python(?:3)?\s+-m\s+)?pip(?:3)?\s+install\b/.test(command)) {
    // pip's hash-checking mode refuses every unhashed direct or transitive requirement itself.
    if (/(?:^|\s)--require-hashes(?:\s|$)/.test(command)) return true;
    const targets = command.replace(/^(?:python(?:3)?\s+-m\s+)?pip(?:3)?\s+install\s*/, '').split(/\s+/).filter((token) => !token.startsWith('-'));
    return targets.length > 0 && targets.every((target) => /^git\+https:\/\/\S+@[a-f\d]{40}$/i.test(target) || verifiedArtifact(target, prior));
  }
  if (/^go\s+install\b/.test(command)) {
    const targets = command.replace(/^go\s+install\s*/, '').split(/\s+/).filter((token) => !token.startsWith('-'));
    return targets.length > 0 && targets.every((target) => /^[\w./-]+@[a-f\d]{40}$/i.test(target));
  }
  const targets = command.replace(/^npm\s+(?:(?:-g|--global|--location=global)\s+)*(?:i|install)\s*/, '').split(/\s+/).filter((token) => !token.startsWith('-')).map((token) => token.replace(/^["']|["']$/g, ''));
  return targets.length > 0 && targets.every((target) => /^git\+https:\/\/\S+#[a-f\d]{40}$/i.test(target) || verifiedArtifact(target, prior));
}

function toolFindings(doc, refuse) {
  const findings = [];
  for (const { key, value } of entries(doc)) {
    if (!['run', 'script'].includes(key) || typeof value !== 'string') continue;
    const script = executable(value);
    const statements = commands(script);
    if (statements.some((command, index) => /^\b(?:curl|wget)\b/.test(commandBody(command.text)) && command.separator === '|' && /^(?:ba)?sh\b/.test(commandBody(statements[index + 1]?.text ?? '')) || /^(?:ba)?sh\s+<\(\s*(?:curl|wget)\b/.test(commandBody(command.text)))) findings.push(refuse(TOOL, 'a downloaded installer must be checksum-verified before execution; curl/wget piped to a shell is forbidden'));
    for (const command of statements) {
      const body = commandBody(command.text);
      const install = /^(?:go\s+install|(?:python(?:3)?\s+-m\s+)?pip(?:3)?\s+install)\b/.test(body) || /^npm\s+(?:(?:-g|--global|--location=global)\s+)*(?:i|install)\b/.test(body) && /(?:^|\s)(?:-g|--global|--location=global)(?:\s|$)/.test(body);
      if (install && !pinnedInstall(body, script.slice(0, command.start))) findings.push(refuse(TOOL, 'tool installs need an immutable hash or a verified artifact; use a SHA-pinned setup action instead of a version-only install'));
    }
  }
  return findings;
}

function perWorkflow({ path: file, text }) {
  const refuse = (code, message) => found(code, file, `${code} ${file}: ${message}`);
  const doc = parseWorkflow(text);
  if (!record(doc)) return [refuse(TRIGGER, 'the workflow must be valid YAML with a release-only on block'), ...(deployName(file) ? [refuse(DEPLOY, 'the deploy workflow must be valid YAML')] : [])];
  return [...triggerFindings(doc, refuse, file), ...deploymentFindings(doc, file, refuse), ...toolFindings(doc, refuse)];
}

/** Synchronous R251 findings over the tracked workflows of a lite/full app. */
export function deployWorkflowFindings(ctx) {
  return appWorkflowFindings(ctx, perWorkflow);
}
