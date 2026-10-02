// catalog.mjs — the ONE loader/validator of the unified starci CLI catalog
// (modules/cli/commands/). Pure: the only I/O is loadCatalog's read pass; every
// check runs on the parsed data. Layout (cli/design.md):
//   modules/cli/commands/_global.yaml            the 5 global flags
//   modules/cli/commands/<group>/_group.yaml     {group, summary, owner, since}
//   modules/cli/commands/<group>/<verb>.yaml     one verb
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

export const CATALOG_DIR = 'modules/cli/commands';
export const CATALOG_SCHEMA = 'starci/cli-catalog@1';
const SINCE = '1.0.0-alpha.4';

const OWNERS = new Set(['runtime', '@starci/hfs']);
const FLAG_TYPES = new Set(['string', 'boolean', 'number', 'enum', 'list']);
const FLAG_KEYS = new Set(['name', 'type', 'required', 'summary', 'enum', 'default', 'global']);
const IMPL_KEYS = new Set(['script', 'args']);
const POS_KEYS = new Set(['name', 'enum', 'required', 'variadic']);
const GROUP_REQUIRED = ['group', 'summary', 'owner', 'since'];
const GROUP_KEYS = new Set([...GROUP_REQUIRED, 'schema']);
const GLOBAL_KEYS = new Set(['schema', 'flags']);
const EDITIONS = ['full', 'lite'];
const GLOBAL_FLAG_NAMES = ['json', 'cwd', 'quiet', 'help', 'edition'];
// A verb file MUST carry every catalog key (flags may be an empty list). Any other
// top-level key is the verb's prose contract (reads, writes, returns, refuses,
// usedBy, inputShape, rawExit, ...) and passes through unchanged — the schema's
// own keys are the only ones with structure to validate.
const VERB_REQUIRED = ['group', 'verb', 'owner', 'summary', 'impl', 'flags', 'exit', 'json', 'examples', 'editions', 'since', 'removed'];
const JSON_RE = /^(always|flag|none|starci\/\S+@\d+)$/;
const NAME_RE = /^[a-z][a-z0-9-]*$/;

const err = (errors, file, msg) => errors.push(`${file}: ${msg}`);

const unknownKeys = (errors, file, obj, allowed, what) => {
  for (const k of Object.keys(obj)) if (!allowed.has(k)) err(errors, file, `unknown ${what} key "${k}"`);
};

const checkFlags = (errors, file, flags, where) => {
  if (!Array.isArray(flags)) { err(errors, file, `${where}: flags must be a list`); return; }
  const seen = new Set();
  for (const f of flags) {
    if (!f || typeof f !== 'object' || Array.isArray(f)) { err(errors, file, `${where}: flag entry is not a map`); continue; }
    unknownKeys(errors, file, f, FLAG_KEYS, 'flag');
    if (typeof f.name !== 'string' || !NAME_RE.test(f.name)) { err(errors, file, `${where}: bad flag name ${JSON.stringify(f.name)}`); continue; }
    if (f.name === 'profile') err(errors, file, `${where}: a flag named "profile" is rejected (profile already means a slot side)`);
    if (seen.has(f.name)) err(errors, file, `${where}: duplicate flag --${f.name}`);
    seen.add(f.name);
    if (!FLAG_TYPES.has(f.type)) err(errors, file, `${where}: --${f.name} type must be one of ${[...FLAG_TYPES].join('|')}`);
    if (f.type === 'enum' && (!Array.isArray(f.enum) || !f.enum.length)) err(errors, file, `${where}: --${f.name} enum needs a non-empty enum list`);
    if (f.name === 'edition' && JSON.stringify(f.enum ?? []) !== JSON.stringify(EDITIONS)) err(errors, file, `${where}: --edition enum is exactly [${EDITIONS.join(', ')}]`);
    if (f.required !== undefined && typeof f.required !== 'boolean') err(errors, file, `${where}: --${f.name} required must be boolean`);
  }
};

const checkVerb = (errors, file, groupName, doc) => {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) { err(errors, file, 'not a map'); return null; }
  for (const k of VERB_REQUIRED) if (!(k in doc)) err(errors, file, `missing required key "${k}"`);
  if (doc.verb !== undefined && doc.verb !== path.basename(file, '.yaml')) err(errors, file, `verb "${doc.verb}" does not match the file name`);
  if (doc.group !== undefined && doc.group !== groupName) err(errors, file, `group "${doc.group}" does not match directory "${groupName}"`);
  if (doc.owner !== undefined && !OWNERS.has(doc.owner)) err(errors, file, `owner must be ${[...OWNERS].join(' | ')}`);
  if (typeof doc.summary === 'string') {
    if (!doc.summary.trim() || doc.summary.length > 100) err(errors, file, 'summary must be one non-empty line of at most 100 chars');
    if (doc.summary.trimEnd().endsWith('.')) err(errors, file, 'summary has a trailing period');
  } else if ('summary' in doc) err(errors, file, 'summary must be a string');
  if (doc.impl !== undefined && doc.impl !== null) {
    if (typeof doc.impl !== 'object' || Array.isArray(doc.impl)) err(errors, file, 'impl must be a map');
    else {
      unknownKeys(errors, file, doc.impl, IMPL_KEYS, 'impl');
      if (typeof doc.impl.script !== 'string' || !doc.impl.script) err(errors, file, 'impl.script is required');
      if (doc.impl.args !== undefined && (!Array.isArray(doc.impl.args) || doc.impl.args.some((a) => typeof a !== 'string'))) err(errors, file, 'impl.args must be a string list');
    }
  }
  if ('flags' in doc) checkFlags(errors, file, doc.flags, `verb ${doc.verb}`);
  if (doc.positional !== undefined) {
    if (!Array.isArray(doc.positional)) err(errors, file, 'positional must be a list');
    else for (const p of doc.positional) {
      if (!p || typeof p !== 'object') { err(errors, file, 'positional entry is not a map'); continue; }
      unknownKeys(errors, file, p, POS_KEYS, 'positional');
      if (typeof p.name !== 'string' || !NAME_RE.test(p.name)) err(errors, file, `bad positional name ${JSON.stringify(p.name)}`);
    }
  }
  if (doc.exit !== undefined) {
    if (!doc.exit || typeof doc.exit !== 'object' || Array.isArray(doc.exit)) err(errors, file, 'exit must be a map of <code>: <text>');
    else for (const code of Object.keys(doc.exit)) if (!/^\d+$/.test(code)) err(errors, file, `exit code "${code}" is not numeric`);
  }
  if (doc.json !== undefined && (typeof doc.json !== 'string' || !JSON_RE.test(doc.json))) err(errors, file, 'json must be always | flag | none | starci/<schema>@<n>');
  for (const k of ['examples', 'editions', 'removed']) {
    if (doc[k] !== undefined && (!Array.isArray(doc[k]) || doc[k].some((x) => typeof x !== 'string'))) err(errors, file, `${k} must be a string list`);
  }
  if (doc.editions !== undefined && !doc.editions.length) err(errors, file, 'editions is empty');
  for (const e of doc.editions ?? []) if (!EDITIONS.includes(e)) err(errors, file, `editions names an unknown edition ${JSON.stringify(e)} (known: ${EDITIONS.join(', ')})`);
  return doc;
};

/**
 * Load and validate the whole catalog under <root>/modules/cli/commands.
 * Returns {global, groups, sources}: global = {flags}, groups = [{group, summary,
 * owner, since, verbs: [verbDocs sorted by verb]}], sources = the catalog file
 * relpaths + bytes (sorted) the generator hashes.
 * Throws Error with .code 'catalog-invalid' and .errors = every finding.
 */
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
  const globalFile = path.join(dir, '_global.yaml');
  let globalDoc = { flags: [] };
  if (!fs.existsSync(globalFile)) err(errors, '_global.yaml', 'missing');
  else {
    globalDoc = read(globalFile) ?? {};
    unknownKeys(errors, '_global.yaml', globalDoc, GLOBAL_KEYS, 'global');
    checkFlags(errors, '_global.yaml', globalDoc.flags, 'global');
    const names = (globalDoc.flags ?? []).map((f) => f?.name);
    for (const want of GLOBAL_FLAG_NAMES) if (!names.includes(want)) err(errors, '_global.yaml', `missing global flag --${want}`);
    for (const got of names) if (!GLOBAL_FLAG_NAMES.includes(got)) err(errors, '_global.yaml', `unknown global flag --${got}`);
  }
  const groups = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const gdir = path.join(dir, entry.name);
    const gfile = path.join(gdir, '_group.yaml');
    let gdoc = {};
    if (!fs.existsSync(gfile)) err(errors, `${entry.name}/_group.yaml`, 'missing');
    else {
      gdoc = read(gfile) ?? {};
      unknownKeys(errors, `${entry.name}/_group.yaml`, gdoc, GROUP_KEYS, 'group');
      for (const k of GROUP_REQUIRED) if (!(k in gdoc)) err(errors, `${entry.name}/_group.yaml`, `missing required key "${k}"`);
      if (gdoc.group !== undefined && gdoc.group !== entry.name) err(errors, `${entry.name}/_group.yaml`, `group "${gdoc.group}" does not match the directory name`);
      if (gdoc.owner !== undefined && !OWNERS.has(gdoc.owner)) err(errors, `${entry.name}/_group.yaml`, `owner must be ${[...OWNERS].join(' | ')}`);
    }
    const verbs = [];
    const seenVerbs = new Map();
    for (const vf of fs.readdirSync(gdir).filter((x) => x.endsWith('.yaml') && !x.startsWith('_')).sort()) {
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
    groups.push({ group: entry.name, summary: gdoc.summary, owner: gdoc.owner, since: gdoc.since, verbs });
  }
  sources.sort((a, b) => a.file.localeCompare(b.file));
  if (errors.length) throw Object.assign(new Error(`catalog-invalid:\n  ${errors.join('\n  ')}`), { code: 'catalog-invalid', errors });
  return { schema: CATALOG_SCHEMA, global: { flags: globalDoc.flags ?? [] }, groups, sources };
};

/** sha256 over the sorted catalog file bytes (the drift hash of the generated module). */
export const catalogHash = async (sources) => {
  const { createHash } = await import('node:crypto');
  const h = createHash('sha256');
  for (const s of sources) h.update(s.bytes);
  return h.digest('hex');
};
