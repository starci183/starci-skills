// env-parity.mjs - R248 HFS_ENV_PARITY (OPS K5/K11): the environment keys a back end reads, the
// keys sealed under `.starcistacks/<env>/secrets/*.enc` and the keys the stack declares or passes are one set,
// compared by name only (owner ruling 0.1.7: every back-end app reads its environment only through the typed
// `EnvSource` of `<app>.env.ts` and the capability `*.config.ts` parse helpers).
//   R = keys the typed `EnvSource` readers consume, found by a static TypeScript walk of `*.env.ts`, `*.config.ts`
//       and `apps/<app>/src/main.ts`: `env.string|url|enum|secret` and `env.int|bool|duration` without a literal
//       fallback are required reads; `env.optional`, `env.has`, `env.anyDeclared` and a fallback read are optional.
//       A template key `${prefix}_WEBHOOK_SECRET` resolves through the literal arguments of its reader's call sites
//       (`parseWebhookProviderConfig(env, "CALENDAR")` yields the key CALENDAR_WEBHOOK_SECRET).
//   S = the key names of the sealed members: a sops envelope keeps its key names cleartext, so `envelopeOf` answers
//       them without decrypting anything.
//   D = keys declared as public config or passed by the stack: the backticked names of
//       `.starcistacks/<env>/runtime/env/KEYS.md`, and the `environment:`/`env:` entries, `runtimeSecrets`, `secrets`
//       and `vars[].name` of every `.starcistacks` yaml. A `<KEY>_FILE` name declares `<KEY>`.
// Findings: ENV_REQUIRED_UNSET a required read sits in neither S nor D; ENV_SEALED_UNREAD a sealed key sits in
// neither R nor a declared consumer; ENV_DUPLICATE one key in two members of one environment; ENV_PUBLIC_SEALED a NEXT_PUBLIC_* key in
// custody; ENV_EXAMPLE_DRIFT a `*.env.example` key nothing reads. The rule judges the app root (`isRoot`): the whole
// tree `all` is its input, both editions.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTypescript } from '../../lib/package-at.mjs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { envelopeOf } from '../secret-document.mjs';
import { found, readText } from './read.mjs';

export const ENV_REQUIRED_UNSET = 'ENV_REQUIRED_UNSET';
export const ENV_SEALED_UNREAD = 'ENV_SEALED_UNREAD';
export const ENV_DUPLICATE = 'ENV_DUPLICATE';
export const ENV_PUBLIC_SEALED = 'ENV_PUBLIC_SEALED';
export const ENV_EXAMPLE_DRIFT = 'ENV_EXAMPLE_DRIFT';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENV_SOURCE = /(?:\.env|\.config)\.ts$/u;
const APP_MAIN = /(?:^|\/)apps\/[^/]+\/src\/main\.ts$/u;
const SEALED_MEMBER = /^\.starcistacks\/[^/]+\/secrets\/[^/]+\.enc$/u;
const KEYS_ROSTER = /^\.starcistacks\/[^/]+\/runtime\/env\/KEYS\.md$/u;
const STACK_YAML = /^\.starcistacks\/.+\.ya?ml$/u;
const ENV_EXAMPLE = /\.env\.example$/u;
const PUBLIC_PREFIX = /^NEXT_PUBLIC_/u;
const KEY_NAME = /^[A-Za-z_]\w*$/u;
const FILE_SUFFIX = /_FILE$/u;
const EXAMPLE_LINE = /^[ \t]*(?:export[ \t]+)?([A-Za-z_]\w*)[ \t]*=(.*)$/u;
const ROSTER_KEY = /`([A-Za-z_][A-Za-z0-9_]*)`/gu;

const REQUIRED_ALWAYS = new Set(['string', 'url', 'secret', 'enum']);
const FALLBACK_OPTIONAL = new Set(['int', 'bool', 'duration']);
const OPTIONAL_ONLY = new Set(['optional', 'has', 'anyDeclared']);
const READER_METHODS = new Set([...REQUIRED_ALWAYS, ...FALLBACK_OPTIONAL, ...OPTIONAL_ONLY]);

const typescriptFor = (repoRoot) => loadTypescript(repoRoot, HERE);

/** A path the static walk reads: `<app>.env.ts`, `<capability>.config.ts` or an app `main.ts`. */
export const isEnvSourcePath = (file) => ENV_SOURCE.test(file) || APP_MAIN.test(file);

/** The `KEY=value` entries of one `*.env.example` text, comments and blank lines out, quotes unwrapped. */
export function envExampleEntries(text) {
  const entries = [];
  for (const line of String(text).split(/\r?\n/u)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = EXAMPLE_LINE.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    entries.push({ key: match[1], value });
  }
  return entries;
}

/** The literal key or template parts a key argument holds; null when it is not statically a name. */
function keyParts(ts, node, params) {
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (!ts.isTemplateExpression(node)) return null;
  const parts = [node.head.text];
  for (const span of node.templateSpans) {
    if (!ts.isIdentifier(span.expression) || !params.includes(span.expression.text)) return null;
    parts.push({ param: span.expression.text }, span.literal.text);
  }
  return parts;
}

/** The env reader context of a function: its EnvSource-typed (or bare `env`) parameter, or null. */
function envContextOf(ts, sourceFile, node) {
  const params = node.parameters ?? [];
  const names = params.map((param) => (ts.isIdentifier(param.name) ? param.name.text : null));
  const index = params.findIndex((param, i) => names[i] !== null
    && (param.type?.getText(sourceFile) === 'EnvSource' || (param.type === undefined && names[i] === 'env')));
  if (index === -1) return null;
  let fn = null;
  if (node.name && ts.isIdentifier(node.name)) fn = node.name.text;
  else if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) fn = node.parent.name.text;
  return { envParam: names[index], params: names.filter(Boolean), fn };
}

const isFunction = (ts, node) => ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node);

/** The shape a reader method declares: `{kind}` for the typed readers, `{kind:'enum', allowed}` for env.enum, null else. */
function shapeOf(ts, method, args) {
  if (method === 'enum') {
    const list = args[1];
    if (!list || !ts.isArrayLiteralExpression(list)) return null;
    const allowed = list.elements.map((element) => (ts.isStringLiteralLike(element) ? element.text : null));
    return allowed.every((value) => value !== null) ? { kind: 'enum', allowed } : null;
  }
  const kind = { string: 'string', secret: 'string', int: 'int', bool: 'bool', url: 'url', duration: 'duration' }[method] ?? null;
  return kind === null ? null : { kind };
}

function noteReadParts(ctx, parts, entry, literals, templates) {
  if (parts === null) return;
  if (parts.every((part) => typeof part === 'string')) literals.push({ key: parts.join(''), ...entry });
  else templates.push({ ...ctx, parts, ...entry });
}

function readAnyDeclared(ts, ctx, keyArg, entry, literals, templates) {
  if (!keyArg || !ts.isArrayLiteralExpression(keyArg)) return;
  const optionalEntry = { ...entry, required: false, shape: null };
  for (const element of keyArg.elements) {
    const parts = ts.isStringLiteralLike(element) ? [element.text] : keyParts(ts, element, ctx.params);
    noteReadParts(ctx, parts, optionalEntry, literals, templates);
  }
}

/** One `env.<method>(...)` call of context `ctx` as a read entry; `required` follows the reader's fallback contract. */
function readCall(ts, ctx, node, file, literals, templates) {
  const method = node.expression.name.text;
  const args = [...node.arguments];
  const required = REQUIRED_ALWAYS.has(method) || (FALLBACK_OPTIONAL.has(method) && args.length < 2);
  const entry = { method, required, shape: required || FALLBACK_OPTIONAL.has(method) ? shapeOf(ts, method, args) : null, file };
  const keyArg = args[0];
  if (method === 'anyDeclared') {
    readAnyDeclared(ts, ctx, keyArg, entry, literals, templates);
    return;
  }
  const parts = keyArg === undefined ? null : keyParts(ts, keyArg, ctx.params);
  noteReadParts(ctx, parts, entry, literals, templates);
}

/** Every env read of one parsed file: concrete literals, per-reader templates and every named call site. */
function readsInFile(ts, sourceFile, rel) {
  const literals = [];
  const templates = [];
  const calls = [];
  const walk = (node, ctx) => {
    if (isFunction(ts, node)) ctx = envContextOf(ts, sourceFile, node) ?? ctx;
    if (ts.isCallExpression(node)) {
      if (ctx && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)
        && node.expression.expression.text === ctx.envParam && READER_METHODS.has(node.expression.name.text)) {
        readCall(ts, ctx, node, rel, literals, templates);
      } else if (ts.isIdentifier(node.expression)) {
        calls.push({ name: node.expression.text, args: node.arguments.map((arg) => (ts.isStringLiteralLike(arg) ? arg.text : null)), file: rel });
      }
    }
    ts.forEachChild(node, (child) => walk(child, ctx));
  };
  walk(sourceFile, null);
  return { literals, templates, calls };
}

function noteEnvRead(reads, { key, required, shape, file }) {
  const held = reads.get(key);
  if (!held) { reads.set(key, { key, required, shape, file }); return; }
  held.required = held.required || required;
  held.shape = held.shape ?? shape;
}

function noteReaderTemplates(readers, templates) {
  for (const template of templates) {
    if (!template.fn) continue;
    if (!readers.has(template.fn)) readers.set(template.fn, { params: template.params, templates: [] });
    readers.get(template.fn).templates.push(template);
  }
}

function resolvedTemplateRead(reader, template, call) {
  const parts = template.parts.map((part) => {
    if (typeof part === 'string') return part;
    const arg = call.args[reader.params.indexOf(part.param)];
    return typeof arg === 'string' ? arg : null;
  });
  if (parts.includes(null)) return null;
  return { key: parts.join(''), required: template.required, shape: template.shape, file: call.file };
}

function noteReaderCall(reads, readers, call) {
  const reader = readers.get(call.name);
  if (!reader) return;
  for (const template of reader.templates) {
    const read = resolvedTemplateRead(reader, template, call);
    if (read !== null) noteEnvRead(reads, read);
  }
}

/**
 * The keys the repository's EnvSource readers consume: Map `KEY` -> {key, required, shape, file}. `relPaths` are
 * repository-relative paths; the env source files (`isEnvSourcePath`) among them are walked. `ts` is the caller's
 * already-resolved compiler; null when none resolves, so the caller decides what "cannot be judged" means.
 */
export function collectEnvReads(repoRoot, relPaths, ts = typescriptFor(repoRoot)) {
  if (!ts) return null;
  const reads = new Map();
  const readers = new Map();
  const calls = [];
  for (const rel of relPaths.filter(isEnvSourcePath)) {
    const text = readText(repoRoot, rel);
    if (text === null) continue;
    const foundIn = readsInFile(ts, ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), rel);
    for (const literal of foundIn.literals) noteEnvRead(reads, literal);
    noteReaderTemplates(readers, foundIn.templates);
    calls.push(...foundIn.calls);
  }
  for (const call of calls) noteReaderCall(reads, readers, call);
  return reads;
}

/** The sealed members' key names without decrypting: Map `KEY` -> the member paths holding it, sorted. */
function sealedKeys(repoRoot, all) {
  const members = new Map();
  for (const file of all) {
    if (!SEALED_MEMBER.test(file)) continue;
    const text = readText(repoRoot, file);
    if (text === null) continue;
    let envelope;
    try { envelope = envelopeOf(text); } catch { continue; }
    for (const key of envelope.keys) {
      if (!members.has(key)) members.set(key, []);
      members.get(key).push(file);
    }
  }
  for (const list of members.values()) list.sort((left, right) => (left < right ? -1 : Number(left > right)));
  return members;
}

function declaredEnvironment(value, add) {
  if (!Array.isArray(value)) {
    for (const name of Object.keys(value)) add(name);
    return;
  }
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const name = /^([A-Za-z_]\w*)\s*=/u.exec(entry)?.[1] ?? (KEY_NAME.test(entry) ? entry : null);
    if (name) add(name);
  }
}

function declaredEntryName(entry, allowString) {
  if (allowString && typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object' && typeof entry.name === 'string') return entry.name;
  return null;
}

function declaredNamedEntries(entries, add, allowString) {
  for (const entry of entries) {
    const name = declaredEntryName(entry, allowString);
    if (name !== null) add(name);
  }
}

function declaredYamlEntry(key, value, add) {
  if ((key === 'environment' || key === 'env') && value && typeof value === 'object') {
    declaredEnvironment(value, add);
    return;
  }
  if ((key === 'runtimeSecrets' || key === 'secrets') && Array.isArray(value)) {
    declaredNamedEntries(value, add, true);
    return;
  }
  if (key === 'vars' && Array.isArray(value)) {
    declaredNamedEntries(value, add, false);
    return;
  }
  declaredFromYaml(value, add);
}

/** The env names one yaml node declares: `environment:`/`env:` keys or `K=V` entries, `runtimeSecrets`, `secrets` and `vars[].name`. */
function declaredFromYaml(node, add) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const item of node) declaredFromYaml(item, add); return; }
  for (const [key, value] of Object.entries(node)) declaredYamlEntry(key, value, add);
}

function addDeclaredKey(declared, name) {
  if (!KEY_NAME.test(name)) return;
  declared.add(name);
  if (FILE_SUFFIX.test(name)) declared.add(name.replace(FILE_SUFFIX, ''));
}

function declareKeysFromText(file, text, add) {
  if (KEYS_ROSTER.test(file)) {
    for (const match of text.matchAll(ROSTER_KEY)) if (/[A-Z]/u.test(match[1])) add(match[1]);
    return;
  }
  try { declaredFromYaml(parseYaml(text), add); } catch { /* a malformed stacks yaml is the shape rule's finding, not this one's */ }
}

/** The keys declared as public config or passed by the stack: KEYS.md rosters plus `.starcistacks` yaml; `<KEY>_FILE` declares `<KEY>`. */
function declaredKeys(repoRoot, all) {
  const declared = new Set();
  const add = (name) => addDeclaredKey(declared, name);
  for (const file of all) {
    if (!KEYS_ROSTER.test(file) && !STACK_YAML.test(file)) continue;
    const text = readText(repoRoot, file);
    if (text !== null) declareKeysFromText(file, text, add);
  }
  return declared;
}

function addRequiredFindings(reads, sealed, declared, findings) {
  for (const read of reads.values()) {
    if (read.required && !sealed.has(read.key) && !declared.has(read.key)) {
      findings.push(found(ENV_REQUIRED_UNSET, read.file, `${read.file} reads required ${read.key}, which is neither sealed under .starcistacks/<env>/secrets/*.enc nor declared by the stack or KEYS.md`));
    }
  }
}

function sealedMemberFinding(key, member, reads, declared) {
  // The specific public-custody code wins over the generic unread one for a NEXT_PUBLIC_* key.
  if (PUBLIC_PREFIX.test(key)) {
    return found(ENV_PUBLIC_SEALED, member, `${member} seals the public key ${key}; NEXT_PUBLIC_* values are public configuration and never enter custody`);
  }
  if (!reads.has(key) && !declared.has(key)) {
    return found(ENV_SEALED_UNREAD, member, `${member} seals ${key}, which no EnvSource reader and no declared consumer uses; unseal it or declare who consumes it`);
  }
  return null;
}

function addSealedFindings(sealed, reads, declared, findings) {
  for (const [key, members] of sealed) {
    for (const member of members) {
      const finding = sealedMemberFinding(key, member, reads, declared);
      if (finding !== null) findings.push(finding);
    }
    addDuplicateFindings(key, members, findings);
  }
}

function addDuplicateFindings(key, members, findings) {
  const firstByEnvironment = new Map();
  for (const member of members) {
    const environment = member.split('/')[1];
    const first = firstByEnvironment.get(environment);
    if (first === undefined) {
      firstByEnvironment.set(environment, member);
      continue;
    }
    findings.push(found(ENV_DUPLICATE, member, `${key} is sealed in ${first} and again in ${member}; one key lives in one member per environment`));
  }
}

function addExampleFindings(repoRoot, all, reads, findings) {
  for (const file of all.filter((rel) => ENV_EXAMPLE.test(rel))) {
    const text = readText(repoRoot, file);
    if (text === null) continue;
    for (const { key } of envExampleEntries(text)) {
      if (!reads.has(key)) findings.push(found(ENV_EXAMPLE_DRIFT, file, `${file} names ${key}, which no EnvSource reader consumes; align the example with the keys the code reads`));
    }
  }
}

/** The findings of R248 over the tracked paths `all` of an app judged at its root scope (both editions). */
export function envParityFindings({ repoRoot, all = [], isRoot }) {
  if (!isRoot) return [];
  const reads = collectEnvReads(repoRoot, all);
  if (reads === null) {
    return [found(ENV_REQUIRED_UNSET, 'be/', 'the env-key parity cannot be judged: no TypeScript resolves from the app; install the app\'s dependencies', { missing: ['typescript'] })];
  }
  const sealed = sealedKeys(repoRoot, all);
  const declared = declaredKeys(repoRoot, all);
  const findings = [];
  addRequiredFindings(reads, sealed, declared, findings);
  addSealedFindings(sealed, reads, declared, findings);
  addExampleFindings(repoRoot, all, reads, findings);
  return findings;
}
