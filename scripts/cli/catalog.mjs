// catalog.mjs — the ONE loader/validator of the unified starci CLI catalog
// (modules/cli/commands/). Pure: the only I/O is loadCatalog's read pass; every
// check runs on the parsed data. Layout (cli/design.md):
//   modules/cli/commands/_global.yaml            the 5 global flags
//   modules/cli/commands/<group>/_group.yaml     {group, summary, owner}
//   modules/cli/commands/<group>/<verb>.yaml     one verb
import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit } from '../lib/list.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { ROLES } from './roles.mjs';

export const CATALOG_DIR = 'modules/cli/commands';
export const CATALOG_SCHEMA = 'starci/cli-catalog@1';

const OWNERS = new Set(['runtime', '@starci/hfs']);
const FLAG_TYPES = new Set(['string', 'boolean', 'number', 'enum', 'list']);
const FLAG_KEYS = new Set(['name', 'type', 'required', 'summary', 'enum', 'default', 'global']);
const IMPL_KEYS = new Set(['script', 'args', 'module', 'export']);
const POS_KEYS = new Set(['name', 'enum', 'required', 'variadic']);
const GROUP_REQUIRED = ['group', 'summary', 'owner'];
const GROUP_KEYS = new Set([...GROUP_REQUIRED, 'schema']);
const GLOBAL_KEYS = new Set(['schema', 'flags', 'commands']);
const EDITIONS = ['full', 'lite'];
const GLOBAL_FLAG_NAMES = new Set(['json', 'cwd', 'quiet', 'help', 'edition']);
const EFFECTS = ['read', 'local-write', 'host', 'remote', 'publish'];
const EFFECT_SET = new Set(EFFECTS);
const ROLE_SET = new Set(ROLES);
// A verb file MUST carry every catalog key (flags may be an empty list). Any other
// top-level key is the verb's prose contract (reads, writes, returns, refuses,
// usedBy, inputShape, rawExit, ...) and passes through unchanged — the schema's
// own keys are the only ones with structure to validate.
const VERB_REQUIRED = ['group', 'verb', 'owner', 'summary', 'impl', 'flags', 'exit', 'json', 'examples', 'editions'];
const JSON_RE = /^(always|flag|none|starci\/\S+@\d+)$/;
const NAME_RE = /^[a-z][a-z0-9-]*$/;
const EXPORT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const MODULE_ROOTS = ['scripts/', 'ui/'];

const err = (errors, file, msg) => errors.push(`${file}: ${msg}`);

const unknownKeys = (errors, file, obj, allowed, what) => {
  for (const k of Object.keys(obj)) if (!allowed.has(k)) err(errors, file, `unknown ${what} key "${k}"`);
};

const flagFindings = (errors, file, f, where, seen) => {
  if (!f || typeof f !== 'object' || Array.isArray(f)) { err(errors, file, `${where}: flag entry is not a map`); return; }
  unknownKeys(errors, file, f, FLAG_KEYS, 'flag');
  if (typeof f.name !== 'string' || !NAME_RE.test(f.name)) { err(errors, file, `${where}: bad flag name ${JSON.stringify(f.name)}`); return; }
  if (f.name === 'profile') err(errors, file, `${where}: a flag named "profile" is rejected (profile already means a slot side)`);
  if (seen.has(f.name)) err(errors, file, `${where}: duplicate flag --${f.name}`);
  seen.add(f.name);
  if (!FLAG_TYPES.has(f.type)) err(errors, file, `${where}: --${f.name} type must be one of ${[...FLAG_TYPES].join('|')}`);
  if (f.type === 'enum' && (!Array.isArray(f.enum) || !f.enum.length)) err(errors, file, `${where}: --${f.name} enum needs a non-empty enum list`);
  if (f.name === 'edition' && JSON.stringify(f.enum ?? []) !== JSON.stringify(EDITIONS)) err(errors, file, `${where}: --edition enum is exactly [${EDITIONS.join(', ')}]`);
  if (f.required !== undefined && typeof f.required !== 'boolean') err(errors, file, `${where}: --${f.name} required must be boolean`);
};

const checkFlags = (errors, file, flags, where) => {
  if (!Array.isArray(flags)) { err(errors, file, `${where}: flags must be a list`); return; }
  const seen = new Set();
  for (const f of flags) flagFindings(errors, file, f, where, seen);
};

const checkStringList = (errors, file, value, name) => {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    err(errors, file, `${name} must be a string list`);
    return false;
  }
  return true;
};

const roleFindings = (errors, file, roles) => {
  if (!checkStringList(errors, file, roles, 'roles')) return;
  if (!roles.length) err(errors, file, 'roles is empty');
  const seen = new Set();
  for (const role of roles) {
    if (!ROLE_SET.has(role)) err(errors, file, `roles names an unknown role ${JSON.stringify(role)} (known: ${ROLES.join(', ')})`);
    if (seen.has(role)) err(errors, file, `roles repeats ${JSON.stringify(role)}`);
    seen.add(role);
  }
};

const conventionFindings = (errors, file, conventions) => {
  if (!checkStringList(errors, file, conventions, 'conventions')) return;
  for (const convention of conventions) {
    if (!convention.trim()) err(errors, file, 'conventions entries must be non-empty');
    else if (convention.length > 160) err(errors, file, 'conventions entries must be at most 160 chars');
  }
};

const checkVerbPolicy = (errors, file, doc, moduleImpl) => {
  if (moduleImpl && doc.effect === undefined) err(errors, file, 'module impl requires effect');
  if (doc.effect !== undefined && !EFFECT_SET.has(doc.effect)) err(errors, file, `effect must be one of ${EFFECTS.join(' | ')}`);
  if (moduleImpl && doc.roles === undefined) err(errors, file, 'module impl requires roles');
  if (doc.roles !== undefined) roleFindings(errors, file, doc.roles);
  if (doc.conventions !== undefined) conventionFindings(errors, file, doc.conventions);
  if (doc.effect !== undefined && doc.effect !== 'read' && (!Array.isArray(doc.conventions) || doc.conventions.length === 0)) {
    err(errors, file, `effect ${doc.effect} requires at least one convention`);
  }
};

const summaryFindings = (errors, file, doc) => {
  if (typeof doc.summary === 'string') {
    if (!doc.summary.trim() || doc.summary.length > 100) err(errors, file, 'summary must be one non-empty line of at most 100 chars');
    if (doc.summary.trimEnd().endsWith('.')) err(errors, file, 'summary has a trailing period');
  } else if ('summary' in doc) err(errors, file, 'summary must be a string');
};

const verbHeaderFindings = (errors, file, groupName, doc) => {
  for (const k of VERB_REQUIRED) if (!(k in doc)) err(errors, file, `missing required key "${k}"`);
  if (doc.verb !== undefined && doc.verb !== path.basename(file, '.yaml')) err(errors, file, `verb "${doc.verb}" does not match the file name`);
  if (doc.group !== undefined && doc.group !== groupName) err(errors, file, `group "${doc.group}" does not match directory "${groupName}"`);
  if (doc.owner !== undefined && !OWNERS.has(doc.owner)) err(errors, file, `owner must be ${[...OWNERS].join(' | ')}`);
  summaryFindings(errors, file, doc);
};

const scriptImplFindings = (errors, file, impl) => {
  if (typeof impl.script !== 'string' || !impl.script) err(errors, file, 'impl.script is required');
  if (impl.args !== undefined && (!Array.isArray(impl.args) || impl.args.some((a) => typeof a !== 'string'))) err(errors, file, 'impl.args must be a string list');
  if (Object.hasOwn(impl, 'export')) err(errors, file, 'impl.export is only valid with impl.module');
};

const moduleImplFindings = (errors, file, impl) => {
  if (typeof impl.module !== 'string' || !impl.module) err(errors, file, 'impl.module is required');
  else if (!MODULE_ROOTS.some((root) => impl.module.startsWith(root)) || !impl.module.endsWith('.mjs') || path.posix.normalize(impl.module) !== impl.module) {
    err(errors, file, 'impl.module must be a repo-relative .mjs path under scripts/ or ui/');
  }
  if (typeof impl.export !== 'string' || !EXPORT_RE.test(impl.export)) err(errors, file, 'impl.export must be an identifier');
  if (Object.hasOwn(impl, 'args')) err(errors, file, 'impl.args is only valid with impl.script');
};

const implementationMapFindings = (errors, file, impl) => {
  unknownKeys(errors, file, impl, IMPL_KEYS, 'impl');
  const hasScript = Object.hasOwn(impl, 'script');
  const hasModule = Object.hasOwn(impl, 'module');
  if (hasScript === hasModule) err(errors, file, 'impl must name exactly one of script or module');
  if (hasScript) scriptImplFindings(errors, file, impl);
  if (hasModule) moduleImplFindings(errors, file, impl);
  return hasModule;
};

const implementationFindings = (errors, file, doc) => {
  if (doc.impl === null) {
    if (doc.owner !== '@starci/hfs') err(errors, file, 'impl must be a script or module map');
    return false;
  }
  if (doc.impl === undefined) return false;
  if (typeof doc.impl !== 'object' || Array.isArray(doc.impl)) {
    err(errors, file, 'impl must be a map');
    return false;
  }
  return implementationMapFindings(errors, file, doc.impl);
};

const positionalFindings = (errors, file, positional) => {
  if (!Array.isArray(positional)) { err(errors, file, 'positional must be a list'); return; }
  for (const item of positional) {
    if (!item || typeof item !== 'object') { err(errors, file, 'positional entry is not a map'); continue; }
    unknownKeys(errors, file, item, POS_KEYS, 'positional');
    if (typeof item.name !== 'string' || !NAME_RE.test(item.name)) err(errors, file, `bad positional name ${JSON.stringify(item.name)}`);
  }
};

const exitCodeFindings = (errors, file, codes) => {
  for (const code of codes) if (!/^\d+$/.test(code)) err(errors, file, `exit code "${code}" is not numeric`);
};

const exitFindings = (errors, file, exit) => {
  if (exit === undefined) return;
  if (!exit || typeof exit !== 'object' || Array.isArray(exit)) err(errors, file, 'exit must be a map of <code>: <text>');
  else exitCodeFindings(errors, file, Object.keys(exit));
};

const editionFindings = (errors, file, editions) => {
  if (editions !== undefined) checkStringList(errors, file, editions, 'editions');
  if (editions !== undefined && !editions.length) err(errors, file, 'editions is empty');
  for (const edition of editions ?? []) if (!EDITIONS.includes(edition)) err(errors, file, `editions names an unknown edition ${JSON.stringify(edition)} (known: ${EDITIONS.join(', ')})`);
};

const exitAndEditionFindings = (errors, file, doc) => {
  exitFindings(errors, file, doc.exit);
  if (doc.json !== undefined && (typeof doc.json !== 'string' || !JSON_RE.test(doc.json))) err(errors, file, 'json must be always | flag | none | starci/<schema>@<n>');
  if (doc.examples !== undefined) checkStringList(errors, file, doc.examples, 'examples');
  editionFindings(errors, file, doc.editions);
};

const checkVerb = (errors, file, groupName, doc) => {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) { err(errors, file, 'not a map'); return null; }
  verbHeaderFindings(errors, file, groupName, doc);
  const moduleImpl = implementationFindings(errors, file, doc);
  checkVerbPolicy(errors, file, doc, moduleImpl);
  if ('flags' in doc) checkFlags(errors, file, doc.flags, `verb ${doc.verb}`);
  if (doc.positional !== undefined) positionalFindings(errors, file, doc.positional);
  exitAndEditionFindings(errors, file, doc);
  return doc;
};

/**
 * Load and validate the whole catalog under <root>/modules/cli/commands.
 * Returns {global, groups, sources}: global = {flags}, groups = [{group, summary,
 * owner, verbs: [verbDocs sorted by verb]}], sources = the catalog file
 * relpaths + bytes (sorted) the generator hashes.
 * Throws Error with .code 'catalog-invalid' and .errors = every finding.
 */
const globalCommandFindings = (errors, commands) => {
  if (!checkStringList(errors, '_global.yaml', commands, 'commands')) return;
  const seen = new Set();
  for (const command of commands) {
    if (!NAME_RE.test(command)) err(errors, '_global.yaml', `bad global command name ${JSON.stringify(command)}`);
    if (seen.has(command)) err(errors, '_global.yaml', `duplicate global command ${JSON.stringify(command)}`);
    seen.add(command);
  }
};

const globalDocument = (dir, errors, read) => {
  const globalFile = path.join(dir, '_global.yaml');
  if (!fs.existsSync(globalFile)) { err(errors, '_global.yaml', 'missing'); return { flags: [] }; }
  const globalDoc = read(globalFile) ?? {};
  unknownKeys(errors, '_global.yaml', globalDoc, GLOBAL_KEYS, 'global');
  checkFlags(errors, '_global.yaml', globalDoc.flags, 'global');
  const names = (globalDoc.flags ?? []).map((f) => f?.name);
  for (const want of GLOBAL_FLAG_NAMES) if (!names.includes(want)) err(errors, '_global.yaml', `missing global flag --${want}`);
  for (const got of names) if (!GLOBAL_FLAG_NAMES.has(got)) err(errors, '_global.yaml', `unknown global flag --${got}`);
  if (globalDoc.commands !== undefined) globalCommandFindings(errors, globalDoc.commands);
  return globalDoc;
};

const groupDocument = (entry, gdir, errors, read) => {
  const gfile = path.join(gdir, '_group.yaml');
  if (!fs.existsSync(gfile)) { err(errors, `${entry.name}/_group.yaml`, 'missing'); return {}; }
  const gdoc = read(gfile) ?? {};
  unknownKeys(errors, `${entry.name}/_group.yaml`, gdoc, GROUP_KEYS, 'group');
  for (const k of GROUP_REQUIRED) if (!(k in gdoc)) err(errors, `${entry.name}/_group.yaml`, `missing required key "${k}"`);
  if (gdoc.group !== undefined && gdoc.group !== entry.name) err(errors, `${entry.name}/_group.yaml`, `group "${gdoc.group}" does not match the directory name`);
  if (gdoc.owner !== undefined && !OWNERS.has(gdoc.owner)) err(errors, `${entry.name}/_group.yaml`, `owner must be ${[...OWNERS].join(' | ')}`);
  return gdoc;
};

const groupVerbs = (entry, gdir, errors, read) => {
  const verbs = [];
  const seenVerbs = new Map();
  const files = fs.readdirSync(gdir).filter((name) => name.endsWith('.yaml') && !name.startsWith('_')).sort(byCodeUnit);
  for (const vf of files) {
    const file = path.join(gdir, vf);
    const doc = checkVerb(errors, `${entry.name}/${vf}`, entry.name, read(file));
    if (!doc || errors.length && doc.verb === undefined) continue;
    if (doc.verb !== undefined) {
      if (seenVerbs.has(doc.verb)) err(errors, `${entry.name}/${vf}`, `duplicate verb "${doc.verb}" (also ${seenVerbs.get(doc.verb)})`);
      else seenVerbs.set(doc.verb, `${entry.name}/${vf}`);
    }
    verbs.push(doc);
  }
  if (!verbs.length) err(errors, `${entry.name}/`, 'an empty group is an error');
  verbs.sort((a, b) => String(a?.verb).localeCompare(String(b?.verb)));
  return verbs;
};

const catalogGroups = (dir, errors, read) => {
  const groups = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const gdir = path.join(dir, entry.name);
    const gdoc = groupDocument(entry, gdir, errors, read);
    const verbs = groupVerbs(entry, gdir, errors, read);
    groups.push({ group: entry.name, summary: gdoc.summary, owner: gdoc.owner, verbs });
  }
  return groups;
};

export const loadCatalog = (root = skillRoot) => {
  const dir = path.join(root, CATALOG_DIR);
  const errors = [];
  const sources = [];
  const read = (file) => {
    const bytes = fs.readFileSync(file);
    sources.push({ file: path.relative(root, file).replaceAll(path.sep, '/'), bytes });
    try { return parseYaml(bytes.toString('utf8')); } catch (e) { err(errors, file, `YAML: ${e.message}`); return undefined; }
  };
  if (!fs.existsSync(dir)) throw Object.assign(new Error(`catalog-invalid: ${dir} does not exist`), { code: 'catalog-invalid', errors: [`${CATALOG_DIR} missing`] });
  const globalDoc = globalDocument(dir, errors, read);
  const groups = catalogGroups(dir, errors, read);
  sources.sort((a, b) => a.file.localeCompare(b.file));
  if (errors.length) throw Object.assign(new Error(`catalog-invalid:\n  ${errors.join('\n  ')}`), { code: 'catalog-invalid', errors });
  return { schema: CATALOG_SCHEMA, global: { flags: globalDoc.flags ?? [], commands: globalDoc.commands ?? [] }, groups, sources };
};

/** sha256 over the sorted catalog file bytes (the drift hash of the generated module). */
export const catalogHash = async (sources) => {
  const { createHash } = await import('node:crypto');
  const h = createHash('sha256');
  for (const s of sources) h.update(s.bytes);
  return h.digest('hex');
};
