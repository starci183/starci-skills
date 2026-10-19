// R252: inspect executable source for plaintext loads, tracing and service-role custody.
// Only source is read. Secret files and sealed envelopes are excluded before any read,
// and findings carry a path and a fixed explanation, never source text or values.
import { found, readJson, readText } from './read.mjs';

const PLAINTEXT_LOAD = 'HFS_SCRIPT_PLAINTEXT_LOAD';
const XTRACE = 'HFS_SCRIPT_XTRACE';
const SERVICE_ROLE = 'HFS_SERVICE_ROLE_SCOPE';
const SUPABASE_OWNER = 'be.integrations.supabase';
const SECRET_FILE = /(?:(?:^|\/)(?:secrets?\.env(?:\.[^/]*)?|\.env(?:\.[^/]*)?|\.nivo-lite(?:\/|$)))|(?:\.enc$)/iu;
const EXCLUDED_TREE = /(?:^|\/)(?:node_modules|\.git|\.claude|\.secrets|secrets|tests?|__tests__|docs|coverage|dist|build)(?:\/|$)/u;
const TEST_FILE = /(?:\.(?:spec|test)|-spec)\.[cm]?[jt]sx?$/u;
const SOURCE = /\.(?:[cm]?[jt]sx?|sh|bash|zsh|ksh|ps1|psm1|bat|cmd|py|rb|pl)$/iu;
const WORKFLOW = /(?:^|\/)\.?(?:github\/)?workflows\/[^/]+\.ya?ml$/u;
const DELIVERY = /(?:^|\/)(?:deploy|scripts|bin)\//u;
const DOCKER = /(?:^|\/)(?:Dockerfile(?:\.[^/]*)?|(?:docker-)?compose(?:[.-][^/]*)?\.ya?ml)$/iu;
const SECRET_REFERENCE = /(?:^|[\s/\\'"`(=])(?:secrets?\.env(?:\.[\w.-]+)?|\.env(?:\.[\w.-]+)?|\.nivo-lite(?:[/\\][\w./\\-]*)?)(?=$|[\s/\\'"`),;])/iu;
const EXAMPLE_REFERENCE = /(?:secrets?\.env|\.env)\.(?:example|sample|template)(?=$|[^\w.-])/giu;
const LOAD = /(?:^|[\s;&|('"`])(?:source|cat|tac|less|more|head|tail|grep|egrep|fgrep|awk|gawk|sed|base64|Get-Content|gc|Import-DotEnv|env-cmd|load_dotenv|loadEnvFile|readFile(?:Sync)?|readTextFile(?:Sync)?|ReadAllText|ReadAllLines|dotenv\s*\.\s*(?:config|parse))\b|\b(?:File|IO)\s*\.\s*(?:read|readlines)\b|\.\s*read_(?:text|bytes)\s*\(|(?:^|[\s;&|])\.[\t ]+|(?<!<)<(?!<)/iu;
const READ_CALL = /\b(?:readFile(?:Sync)?|readTextFile(?:Sync)?|ReadAllText|ReadAllLines|load_dotenv|loadEnvFile|dotenv\s*\.\s*(?:config|parse))\s*\(/giu;
const TRACE_COMMAND = /(?:^|[\s;&|('"`]|#!)(?:set|\/?(?:[\w.-]+\/)*(?:bash|sh|dash|zsh|ksh))\s+/giu;
const SHELL_OPTIONS = /\bSHELLOPTS\s*=\s*['"]?([^\s;'"]*)/giu;
const SERVICE_ROLE_NAME = /(?:^|[^a-z0-9])(?:[a-z0-9]+[_-])*service[_-]?role(?:[_-][a-z0-9]+)*(?=$|[^a-z0-9])/iu;

/** Retain executable strings, including remote shell commands, but discard comment-only lines. */
function executableText(text) {
  return text.replace(/\/\*[\s\S]*?\*\//gu, '').split(/\r?\n/u)
    .filter((line) => !/^\s*(?:#(?!!)|\/\/)/u.test(line)).join('\n')
    .replace(/(?:\\|`)\r?\n/gu, ' ');
}

const hasSecretReference = (text) => SECRET_REFERENCE.test(text.replace(EXAMPLE_REFERENCE, 'example-file'));

function callArguments(text, from) {
  let depth = 1;
  let quote = '';
  for (let at = from; at < Math.min(text.length, from + 1024); at += 1) {
    const character = text[at];
    if (character === '\\') { at += 1; continue; }
    if (quote) { if (character === quote) quote = ''; continue; }
    if (['\'', '"', '`'].includes(character)) { quote = character; continue; }
    if (character === '(') depth += 1;
    if (character === ')' && --depth === 0) return text.slice(from, at);
  }
  return '';
}

/** A helper may assign a path first and source/read the variable on the next line. */
function secretAliases(lines) {
  const aliases = [];
  for (const line of lines) {
    const equals = line.indexOf('=');
    if (equals < 0 || !hasSecretReference(line.slice(equals + 1))) continue;
    const name = line.slice(0, equals).trim().replace(/^(?:export|const|let|var)\s+/iu, '').replace(/^\$/u, '');
    if (/^[a-z_]\w*$/iu.test(name)) aliases.push(new RegExp(String.raw`\b${name}\b`, 'u'));
  }
  return aliases;
}

/** JS, .NET and dotenv readers can put their filename on a later line of the call. */
function multilineLoad(text, secretReference) {
  for (const match of text.matchAll(READ_CALL)) {
    const args = callArguments(text, match.index + match[0].length);
    if (secretReference(args)) return true;
  }
  return false;
}

function pythonLoad(text) {
  // Python's default open mode is reading; explicit write/append modes are not loads.
  for (const match of text.matchAll(/\bopen\s*\(/gu)) {
    const args = callArguments(text, match.index + match[0].length).split(',').map((value) => value.trim());
    const filename = /^(['"])([^'"\r\n]+)\1$/u.exec(args[0]);
    const mode = /^(['"])([^'"]*)\1$/u.exec(args[1] ?? '');
    if (filename && (!args[1] || mode && /^[rU]/u.test(mode[2])) && hasSecretReference(filename[2])) return true;
  }
  return false;
}

function plaintextLoad(text) {
  const lines = text.split(/\r?\n/u);
  const aliases = secretAliases(lines);
  const secretReference = (value) => hasSecretReference(value) || aliases.some((alias) => alias.test(value));
  return lines.some((line) => LOAD.test(line) && secretReference(line)) || multilineLoad(text, secretReference) || pythonLoad(text);
}

function tracingOptions(source) {
  let previous = '';
  for (const [token] of source.matchAll(/[^\s;'"})`]+/gu)) {
    if (!token.startsWith('-')) {
      if (!previous || !/^[\w-]+$/u.test(token)) return false;
      if (/^-o$/iu.test(previous) && /^xtrace$/iu.test(token)) return true;
      previous = '';
      continue;
    }
    if (!/^--?[\w-]+$/u.test(token)) return false;
    if (/^-[a-z]+$/iu.test(token) && token.toLowerCase().includes('x')) return true;
    previous = token;
  }
  return false;
}

/** Parse shell options individually so repeated flags cannot create regex backtracking. */
function enablesTracing(text) {
  if (/--reveal\b/iu.test(text)) return true;
  for (const match of text.matchAll(SHELL_OPTIONS)) {
    if (/\bxtrace\b/iu.test(match[1])) return true;
  }
  for (const match of text.matchAll(TRACE_COMMAND)) {
    const from = match.index + match[0].length;
    const newline = text.indexOf('\n', from);
    if (tracingOptions(text.slice(from, newline < 0 ? text.length : newline))) return true;
  }
  return false;
}

function integrationOwns(file, resolver) {
  if (!file.startsWith('be/src/modules/integrations/supabase/')) return false;
  return !resolver?.ownerOf || resolver.ownerOf(file)?.slot === SUPABASE_OWNER;
}

function isSource(file) {
  if (SECRET_FILE.test(file) || EXCLUDED_TREE.test(file) || TEST_FILE.test(file)) return false;
  return SOURCE.test(file) || WORKFLOW.test(file) || DOCKER.test(file)
    || file.endsWith('/package.json') || file === 'package.json'
    || (DELIVERY.test(file) && !/\.[a-z0-9]+$/iu.test(file));
}

function sourceText(repoRoot, file) {
  if (file === 'package.json' || file.endsWith('/package.json')) {
    const scripts = readJson(repoRoot, file)?.scripts;
    return scripts && typeof scripts === 'object' ? Object.values(scripts).filter((value) => typeof value === 'string').join('\n') : null;
  }
  return readText(repoRoot, file);
}

/** Both editions share this custody boundary; the app root scans `all` once, including its sides. */
export function scriptHygieneFindings({ repoRoot, files = [], all = files, repo, resolver, isRoot, inScope = () => true }) {
  if (repo?.kind !== 'app' || !['lite', 'full'].includes(repo.edition) || isRoot === false) return [];
  const findings = [];
  for (const file of new Set(all)) {
    if (!inScope(file) || !isSource(file)) continue;
    const raw = sourceText(repoRoot, file);
    if (raw === null) continue;
    const text = executableText(raw);
    if (plaintextLoad(text)) findings.push(found(PLAINTEXT_LOAD, file, 'Executable source loads a plaintext secret file; use starci app secret with sealed envelopes.'));
    if (enablesTracing(text)) findings.push(found(XTRACE, file, 'Executable source enables shell tracing or secret reveal; remove xtrace and --reveal.'));
    if (SERVICE_ROLE_NAME.test(text.replace(/([a-z0-9])([A-Z])/gu, '$1_$2')) && !integrationOwns(file, resolver)) findings.push(found(SERVICE_ROLE, file, 'Service-role access belongs only to be/src/modules/integrations/supabase/ and its configuration.'));
  }
  return findings;
}
