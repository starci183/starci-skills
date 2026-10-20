// stack-tooling.mjs - R293: an app does not re-implement the Swarm deploy tooling the canon ships as `starci app stack <verb>`.
// Deploy sources (tracked files under deploy/ and scripts/, the scripts of package.json, workflows other than the canon's managed
// stack-deploy.yml) must not call a docker command a verb owns, and deploy/ holds no file named after a verb. A finding names the
// replacing verb and the file, never a snippet of the source.
import { found, readText } from './read.mjs';

export const STACK_TOOLING_REIMPLEMENTED = 'STACK_TOOLING_REIMPLEMENTED';

const MANAGED_WORKFLOW = /(?:^|\/)\.github\/workflows\/stack-deploy\.ya?ml$/;
const WORKFLOW = /(?:^|\/)\.github\/workflows\/[^/]+\.ya?ml$/;
const DEPLOY_DIR = /(?:^|\/)deploy\//;
const SCRIPTS_DIR = /(?:^|\/)scripts\//;
const PACKAGE_JSON = /(?:^|\/)package\.json$/;
const SOURCE_FILE = /(?:^|\/)[^/.]+$|\.(?:sh|bash|zsh|mjs|cjs|js|ts|mts|py|ya?ml)$/;
const TEST_FILE = /\.(?:spec|test)\.[cm]?[jt]s$/;
const CREDENTIAL_ENV_FILE = /(?:^|\/)(?:secrets?\.env|\.env)(?:\.[^/]*)?/i;
const CREDENTIAL_SECRETS_DIR = /(?:^|\/)secrets\//i;
const CREDENTIAL_ENC_FILE = /\.enc$/i;
const isCredentialFile = (file) => CREDENTIAL_ENV_FILE.test(file) || CREDENTIAL_SECRETS_DIR.test(file) || CREDENTIAL_ENC_FILE.test(file);
const VERB_FILE = /^(render|provision|converge|verify|prune|rollback|release|backup|prepare|doctor|jobs|public)\.(?:mjs|js|cjs|sh)$/;
const COMMENT_LINE = /^[ \t]*(?:#|\/\/).*$/gm;
const LINE_CONTINUATION = /\\\r?\n\s*/g;
const VERB_COMMAND = /\bapp\s+stack\b[^\n;&|]*/g;
const DOCKER_OPTIONS = String.raw`(?:\s+(?:--(?:context|host)(?:\s+|=)\S+|-H\s+\S+))*`;
const SHELL_CALL = new RegExp(String.raw`\bdocker${DOCKER_OPTIONS}\s+(stack|secret|config|service|swarm|volume|node)\s+([a-z]+)\b`, 'g');
const ARGV_CALL = /['"]docker['"]\s*,\s*\[\s*['"](stack|secret|config|service|swarm|volume|node)['"]\s*,\s*['"]([a-z]+)['"]/g;

/** `docker <noun> <action>` pairs the canon owns, mapped to the verb that replaces them. */
const OWNED = new Map([
  ['stack deploy', 'deploy'], ['stack config', 'render'],
  ['secret create', 'deploy'], ['secret rm', 'prune'], ['config create', 'deploy'], ['config rm', 'prune'],
  ['service ls', 'converge'], ['service ps', 'converge'], ['service inspect', 'verify'], ['service update', 'rollback'],
  ['swarm init', 'prepare'], ['volume create', 'prepare'], ['node ls', 'doctor'],
]);

/** Comments run nothing; a `starci app stack ...` command line is the canon call itself and is never judged. */
function executableText(text) {
  return text.replaceAll(COMMENT_LINE, '').replaceAll(LINE_CONTINUATION, ' ').replaceAll(VERB_COMMAND, ' ');
}

function ownedVerbs(text) {
  const verbs = new Set();
  for (const pattern of [SHELL_CALL, ARGV_CALL]) {
    for (const [, noun, action] of text.matchAll(pattern)) {
      const verb = OWNED.get(`${noun} ${action}`);
      if (verb) verbs.add(verb);
    }
  }
  return verbs;
}

function packageScripts(text) {
  try {
    return Object.values(JSON.parse(text)?.scripts ?? {}).filter((command) => typeof command === 'string').join('\n');
  } catch { return ''; }
}

function sourceText(file, raw) {
  return executableText(PACKAGE_JSON.test(file) ? packageScripts(raw) : raw);
}

function deploySource(file) {
  if (MANAGED_WORKFLOW.test(file) || isCredentialFile(file) || TEST_FILE.test(file)) return false;
  if (PACKAGE_JSON.test(file) || WORKFLOW.test(file)) return true;
  return (DEPLOY_DIR.test(file) || SCRIPTS_DIR.test(file)) && SOURCE_FILE.test(file);
}

const replacement = (file, verb) => found(
  STACK_TOOLING_REIMPLEMENTED,
  file,
  `${file} re-implements deploy tooling the canon ships; call \`starci app stack ${verb}\` instead`,
  { verb },
);

function fileFindings(repoRoot, file) {
  const raw = readText(repoRoot, file);
  if (raw === null) return [];
  return [...ownedVerbs(sourceText(file, raw))].map((verb) => replacement(file, verb));
}

function verbNamedFile(file) {
  const verb = DEPLOY_DIR.test(file) ? VERB_FILE.exec(file.slice(file.lastIndexOf('/') + 1))?.[1] : undefined;
  return verb ? [replacement(file, verb)] : [];
}

/** Findings are names and paths only: no source snippet leaves this finder. One finding per file and replacing verb. */
export function stackToolingFindings({ repoRoot, files, all, repo, isRoot, inScope = () => true }) {
  if (repo?.kind !== 'app' || !['lite', 'full'].includes(repo.edition) || isRoot === false) return [];
  const findings = new Map();
  for (const file of new Set(all ?? files)) {
    if (!inScope(file)) continue;
    const candidates = [...verbNamedFile(file), ...(deploySource(file) ? fileFindings(repoRoot, file) : [])];
    for (const finding of candidates) findings.set(`${finding.path}\0${finding.verb}`, finding);
  }
  return [...findings.values()];
}
