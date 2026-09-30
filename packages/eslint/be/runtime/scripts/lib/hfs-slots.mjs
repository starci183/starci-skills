// hfs-slots.mjs - the HFS slot manifest and repository declaration, loaded once and asked four questions:
//   which slot owns path P           slotOf(P) / classifyPath(P)   (an unknown path reports its nearest slot)
//   is import A -> B allowed         importAllowed(A, B)           (tier matrix, cross-owner entry, cross-app, layers)
//   which files are required         requiredFiles(P) / requiredPaths()
//   is this path tracked             isTracked(P) / trackingOf(P)
// The rule catalog (knowledge/hfs/rules.yaml, modules/schemas/hfs-rules.schema.yaml) loads through loadRuleCatalog / rules().
// Every check and lint rule of HFS reads knowledge/hfs/slots.yaml through this module; none keeps its own path
// list. The manifest shape is modules/schemas/hfs-slots.schema.yaml and hfs.json is modules/schemas/hfs-repo.schema.yaml;
// the installed runtime carries no npm dependency, so this file re-states those shapes instead of loading ajv
// (tests/hfs-slots.spec.mjs proves the two agree).
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { braceVariants } from './glob.mjs';
import { posixPath } from './path-key.mjs';
import { isPlainObject } from '../../engine/plain-object.mjs';

export const HFS_MANIFEST_FILE = 'knowledge/hfs/slots.yaml';
export const HFS_DECLARATION_FILE = 'hfs.json';

/** A refusal with a catalogued code (modules/kernel/failure-codes.yaml) and the facts a check reports. */
export class HfsSlotsError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = 'HfsSlotsError';
    this.code = code;
    this.details = details;
  }
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const NAME = /^[a-z][a-z0-9-]*$/;
const ENV_PREFIX = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;
const SLOT_ID = /^(repo|be|fe)\.[a-z0-9-]+(\.[a-z0-9-]+)*$/;
const PRESENCE = ['required', 'optional', 'opt-in', 'forbidden'];
const TRACKED = ['tracked', 'ignored', 'external'];
const TESTS = ['unit-beside', 'e2e', 'none'];
const PROFILES = ['be', 'fe'];
const strList = (v) => Array.isArray(v) && v.every((s) => typeof s === 'string' && s.length > 0);

// ------------------------------------------------------------------------------------------------ patterns

const VAR = /<([A-Za-z][A-Za-z0-9-]*)>/g;
const varsOf = (text) => [...String(text).matchAll(VAR)].map((m) => m[1]);
const hasWildcard = (segment) => /[*?]/.test(segment);

/** Weight of one pattern segment: literal 4, literal mixed with a variable 3, a bare variable 2, a wildcard 1, `**` 0. */
function segmentWeight(segment) {
  if (segment === '**') return 0;
  if (hasWildcard(segment)) return 1;
  if (/^<[^>]+>$/.test(segment)) return 2;
  if (segment.includes('<')) return 3;
  return 4;
}

/** The RegExp source of one pattern segment (no separators); variables capture, and are listed in `names`. */
function segmentSource(segment, names) {
  let source = '';
  for (let i = 0; i < segment.length; i += 1) {
    const c = segment[i];
    if (c === '<') {
      const end = segment.indexOf('>', i);
      names.push(segment.slice(i + 1, end));
      source += '([^/]+?)';
      i = end;
    } else if (c === '*') source += '[^/]*';
    else if (c === '?') source += '[^/]';
    else source += /[.+^${}()|[\]\\]/.test(c) ? `\\${c}` : c;
  }
  return source;
}

/** One brace-free pattern compiled: `dir` patterns (trailing /) own everything below their root. */
function compileVariant(slot, pattern) {
  const dir = pattern.endsWith('/');
  const body = dir ? pattern.slice(0, -1) : pattern;
  const segments = body.split('/');
  const names = [];
  let source = '';
  segments.forEach((segment, index) => {
    const last = index === segments.length - 1;
    if (segment === '**') source += last ? '.*' : '(?:.*/)?';
    else source += segmentSource(segment, names) + (last ? '' : '/');
  });
  return {
    slot,
    pattern,
    dir,
    segments,
    names,
    score: segments.reduce((sum, s) => sum + segmentWeight(s), 0),
    wildcards: segments.filter(hasWildcard).length,
    regex: new RegExp(`^(${source})${dir ? '(?:/.*)?' : ''}$`),
    segmentRegexes: segments.map((s) => (s === '**' ? null : new RegExp(`^${segmentSource(s, [])}$`))),
  };
}

const variantsOf = (slot) => braceVariants(slot.path).map((pattern) => compileVariant(slot, pattern));

const levenshtein = (a, b) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const held = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = held;
    }
  }
  return row[b.length];
};

// ------------------------------------------------------------------------------------------- manifest

const fail = (code, message, details) => { throw new HfsSlotsError(code, message, details); };

/** Shape problems of a parsed manifest, in the words of modules/schemas/hfs-slots.schema.yaml. */
function manifestShapeProblems(m) {
  const bad = [];
  if (!isPlainObject(m)) return ['the manifest is not a map'];
  const allowed = new Set(['schema', 'version', 'versioning', 'presenceValues', 'trackedValues', 'testValues', 'appKinds', 'tiers', 'ruleParams', 'crossOwner', 'crossApp', 'slots', 'consumers']);
  for (const key of Object.keys(m)) if (!allowed.has(key)) bad.push(`unknown top-level key ${key}`);
  if (!/^starci\/hfs-slots@\d+$/.test(String(m.schema))) bad.push('schema must be starci/hfs-slots@<major>');
  if (!SEMVER.test(String(m.version))) bad.push('version must be MAJOR.MINOR.PATCH');
  if (!isPlainObject(m.versioning) || !['patch', 'minor', 'major', 'retire', 'pins'].every((k) => typeof m.versioning[k] === 'string')) bad.push('versioning needs patch, minor, major, retire and pins text');
  if (JSON.stringify(m.presenceValues) !== JSON.stringify(PRESENCE)) bad.push(`presenceValues must be ${PRESENCE.join(', ')}`);
  if (JSON.stringify(m.trackedValues) !== JSON.stringify(TRACKED)) bad.push(`trackedValues must be ${TRACKED.join(', ')}`);
  if (JSON.stringify(m.testValues) !== JSON.stringify(TESTS)) bad.push(`testValues must be ${TESTS.join(', ')}`);
  for (const key of ['appKinds', 'tiers']) {
    if (!isPlainObject(m[key])) { bad.push(`${key} must be a map with be and fe`); continue; }
    for (const extra of Object.keys(m[key])) if (!PROFILES.includes(extra)) bad.push(`${key}.${extra} is not a profile`);
    for (const profile of PROFILES) if (!(profile in m[key])) bad.push(`${key}.${profile} is missing`);
  }
  for (const profile of PROFILES) {
    const kinds = m.appKinds?.[profile];
    if (kinds !== undefined && (!Array.isArray(kinds) || !kinds.length || !kinds.every((k) => NAME.test(String(k))) || new Set(kinds).size !== kinds.length)) bad.push(`appKinds.${profile} must be a non-empty list of unique names`);
    const tiers = m.tiers?.[profile];
    if (tiers === undefined) continue;
    if (!isPlainObject(tiers) || !Object.keys(tiers).length) { bad.push(`tiers.${profile} must be a non-empty map`); continue; }
    for (const [tier, def] of Object.entries(tiers)) {
      if (!NAME.test(tier)) bad.push(`tiers.${profile}.${tier} is not a tier name`);
      if (!isPlainObject(def) || !Array.isArray(def.mayImport) || !def.mayImport.every((t) => NAME.test(String(t)))) bad.push(`tiers.${profile}.${tier}.mayImport must be a list of tier names`);
      for (const key of Object.keys(def ?? {})) if (!['mayImport', 'acyclic', 'lowerLayerOnly'].includes(key)) bad.push(`tiers.${profile}.${tier}.${key} is not a tier field`);
    }
  }
  const blockOk = (v) => isPlainObject(v) && Number.isInteger(v.lines) && v.lines >= 2 && Number.isInteger(v.tokens) && v.tokens >= 1 && Object.keys(v).length === 2;
  const fileLinesOk = (v) => isPlainObject(v) && Number.isInteger(v.soft) && v.soft >= 1 && typeof v.hardGrowth === 'boolean' && Object.keys(v).length === 2;
  const rp = m.ruleParams;
  if (!isPlainObject(rp) || Object.keys(rp).some((k) => !PROFILES.includes(k)) || !PROFILES.every((p) => isPlainObject(rp[p]))) bad.push('ruleParams must be a map with be and fe');
  else {
    if (!fileLinesOk(rp.be.fileLines) || !blockOk(rp.be.duplicateBlock) || Object.keys(rp.be).length !== 5) bad.push('ruleParams.be needs fileLines {soft, hardGrowth}, duplicateBlock {lines >= 2, tokens >= 1}, infraOwners, suffixes and bannedSuffixes');
    const owners = rp.be.infraOwners;
    const ownerId = /^(platform|integrations)\/[a-z][a-z0-9-]*$/;
    if (!isPlainObject(owners) || !Object.keys(owners).length || !Object.entries(owners).every(([key, list]) => key && Array.isArray(list) && list.every((o) => ownerId.test(String(o))) && new Set(list).size === list.length)) bad.push('ruleParams.be.infraOwners must map a non-empty specifier to a list of unique platform/<capability> or integrations/<provider> owners ([] means nowhere)');
    const roleList = (v) => Array.isArray(v) && v.length > 0 && v.every((x) => /^[a-z][a-z0-9-]*$/.test(String(x))) && new Set(v).size === v.length;
    if (!roleList(rp.be.suffixes)) bad.push('ruleParams.be.suffixes must be a non-empty list of unique kebab-case role suffixes');
    if (!roleList(rp.be.bannedSuffixes)) bad.push('ruleParams.be.bannedSuffixes must be a non-empty list of unique kebab-case suffixes');
    else if (roleList(rp.be.suffixes) && rp.be.suffixes.some((x) => rp.be.bannedSuffixes.includes(x))) bad.push('ruleParams.be.suffixes and bannedSuffixes must be disjoint');
    if (!fileLinesOk(rp.fe.fileLines) || !blockOk(rp.fe.duplicateBlock) || Object.keys(rp.fe).length !== 2) bad.push('ruleParams.fe needs fileLines {soft, hardGrowth} and duplicateBlock {lines >= 2, tokens >= 1}');
  }
  if (!Array.isArray(m.slots) || !m.slots.length) { bad.push('slots must be a non-empty list'); return bad; }
  const slotKeys = new Set(['id', 'profiles', 'path', 'presence', 'tracked', 'tier', 'tests', 'owner', 'appKind', 'minInstances', 'requiredWhen', 'requiredInstances', 'requires', 'allows', 'forbids', 'layers', 'kinds', 'roles', 'composedBy', 'budget', 'managedBy', 'rules', 'goesTo', 'why', 'since', 'retiredIn', 'successor']);
  m.slots.forEach((slot, index) => {
    const at = isPlainObject(slot) && typeof slot.id === 'string' ? `slot ${slot.id}` : `slots[${index}]`;
    if (!isPlainObject(slot)) { bad.push(`${at} is not a map`); return; }
    for (const key of Object.keys(slot)) if (!slotKeys.has(key)) bad.push(`${at}: unknown field ${key}`);
    if (!SLOT_ID.test(String(slot.id))) bad.push(`${at}: id must look like be.transport.http`);
    if (!Array.isArray(slot.profiles) || !slot.profiles.length || !slot.profiles.every((p) => PROFILES.includes(p)) || new Set(slot.profiles).size !== slot.profiles.length) bad.push(`${at}: profiles must be a unique non-empty subset of be, fe`);
    if (typeof slot.path !== 'string' || !slot.path) bad.push(`${at}: path is required`);
    if (!PRESENCE.includes(slot.presence)) bad.push(`${at}: presence must be one of ${PRESENCE.join(', ')}`);
    if (!TRACKED.includes(slot.tracked)) bad.push(`${at}: tracked must be one of ${TRACKED.join(', ')}`);
    if (!NAME.test(String(slot.tier))) bad.push(`${at}: tier must be a tier name, none or inherit`);
    if (!TESTS.includes(slot.tests)) bad.push(`${at}: tests must be one of ${TESTS.join(', ')}`);
    if (slot.owner !== undefined && typeof slot.owner !== 'boolean') bad.push(`${at}: owner must be a boolean`);
    if (slot.appKind !== undefined && !NAME.test(String(slot.appKind))) bad.push(`${at}: appKind must be a name`);
    if (slot.minInstances !== undefined && !(Number.isInteger(slot.minInstances) && slot.minInstances >= 1)) bad.push(`${at}: minInstances must be a positive integer`);
    if (slot.requiredWhen !== undefined && slot.requiredWhen !== 'connections') bad.push(`${at}: requiredWhen may only be connections`);
    if (slot.requiredInstances !== undefined && !(isPlainObject(slot.requiredInstances) && Object.values(slot.requiredInstances).every((v) => strList(v) && v.length))) bad.push(`${at}: requiredInstances must map a variable to a non-empty list of names`);
    for (const key of ['requires', 'allows', 'forbids', 'layers', 'kinds']) if (slot[key] !== undefined && !strList(slot[key])) bad.push(`${at}: ${key} must be a list of strings`);
    if (slot.kinds !== undefined && strList(slot.kinds) && (!slot.kinds.length || new Set(slot.kinds).size !== slot.kinds.length || slot.kinds.some((k) => !NAME.test(k) || (slot.layers ?? []).includes(k)))) bad.push(`${at}: kinds must be a non-empty list of unique folder names that are not layers`);
    if (slot.roles !== undefined && !(isPlainObject(slot.roles) && Object.keys(slot.roles).length && Object.entries(slot.roles).every(([role, file]) => NAME.test(role) && typeof file === 'string' && file && !file.includes('/')))) bad.push(`${at}: roles must map a role name to a file name`);
    if (slot.composedBy !== undefined && !(strList(slot.composedBy) && slot.composedBy.length && new Set(slot.composedBy).size === slot.composedBy.length)) bad.push(`${at}: composedBy must be a non-empty list of unique app kinds`);
    if (slot.budget !== undefined && !(isPlainObject(slot.budget) && Object.keys(slot.budget).length && Object.values(slot.budget).every((v) => Number.isInteger(v) && v >= 1))) bad.push(`${at}: budget must map names to positive integers`);
    if (slot.managedBy !== undefined && !NAME.test(String(slot.managedBy))) bad.push(`${at}: managedBy must be a template id`);
    if (slot.rules !== undefined && !(Array.isArray(slot.rules) && slot.rules.every((r) => /^[A-Z][A-Z0-9_]*\*?$/.test(String(r))) && new Set(slot.rules).size === slot.rules.length)) bad.push(`${at}: rules must be unique rule ids`);
    if (slot.since !== undefined && !SEMVER.test(String(slot.since))) bad.push(`${at}: since must be a version`);
    if (slot.retiredIn !== undefined && !(Number.isInteger(slot.retiredIn) && slot.retiredIn >= 2)) bad.push(`${at}: retiredIn must be a major`);
    if (slot.retiredIn !== undefined && typeof slot.successor !== 'string') bad.push(`${at}: a retired slot names its successor`);
    if (slot.tracked === 'external' && (typeof slot.goesTo !== 'string' || slot.presence !== 'forbidden')) bad.push(`${at}: an external slot is forbidden and says where it goes (goesTo)`);
    if (slot.presence === 'forbidden' && slot.tracked !== 'external') bad.push(`${at}: a forbidden slot is external`);
  });
  return bad;
}

/** The rules a JSON Schema cannot state: unique ids, tiers named and reachable, app kinds, variables, no duplicate pattern. */
function manifestSemanticProblems(m) {
  const bad = [];
  const ids = new Set();
  const claimed = new Map();
  for (const slot of m.slots) {
    if (ids.has(slot.id)) bad.push(`slot id ${slot.id} appears twice`);
    ids.add(slot.id);
    const pathVars = new Set(varsOf(slot.path));
    for (const profile of slot.profiles) {
      const tiers = m.tiers[profile];
      if (slot.tier !== 'none' && slot.tier !== 'inherit' && !(slot.tier in tiers)) bad.push(`slot ${slot.id}: tier ${slot.tier} is not a ${profile} tier`);
      if (slot.appKind !== undefined && !m.appKinds[profile].includes(slot.appKind)) bad.push(`slot ${slot.id}: app kind ${slot.appKind} is not a ${profile} kind`);
      if (slot.appKind === undefined) {
        for (const variant of braceVariants(slot.path)) {
          const key = `${profile}:${variant}`;
          if (claimed.has(key)) bad.push(`slots ${claimed.get(key)} and ${slot.id} claim the same pattern ${variant} on ${profile}`);
          else claimed.set(key, slot.id);
        }
      }
    }
    if (slot.appKind !== undefined && !pathVars.has('app')) bad.push(`slot ${slot.id}: an app-kind slot binds <app> in its path`);
    if (slot.requiredWhen !== undefined && slot.presence !== 'required') bad.push(`slot ${slot.id}: requiredWhen belongs to a required slot`);
    for (const name of Object.keys(slot.requiredInstances ?? {})) if (!pathVars.has(name)) bad.push(`slot ${slot.id}: requiredInstances names <${name}>, which the path does not bind`);
    for (const file of Object.values(slot.roles ?? {})) for (const name of varsOf(file)) if (!pathVars.has(name)) bad.push(`slot ${slot.id}: roles names <${name}> in ${file}, which the path does not bind`);
    for (const entry of slot.requires ?? []) for (const name of varsOf(entry)) if (!pathVars.has(name)) bad.push(`slot ${slot.id}: requires ${entry} uses <${name}>, which the path does not bind`);
    for (const variant of braceVariants(slot.path)) {
      try { compileVariant(slot, variant); } catch (error) { bad.push(`slot ${slot.id}: pattern ${variant} does not compile (${error.message})`); }
    }
    if (slot.successor !== undefined && !m.slots.some((s) => s.id === slot.successor)) bad.push(`slot ${slot.id}: successor ${slot.successor} is not a slot`);
    for (const kind of slot.composedBy ?? []) if (!slot.profiles.every((p) => m.appKinds[p].includes(kind))) bad.push(`slot ${slot.id}: composedBy names ${kind}, which is not an app kind of every profile of the slot`);
    if (slot.layers !== undefined && slot.tier !== 'none' && !slot.profiles.every((p) => m.tiers[p][slot.tier]?.lowerLayerOnly)) bad.push(`slot ${slot.id}: layers need a lowerLayerOnly tier`);
  }
  for (const profile of PROFILES) {
    for (const [tier, def] of Object.entries(m.tiers[profile])) {
      for (const target of def.mayImport) if (!(target in m.tiers[profile])) bad.push(`tiers.${profile}.${tier}.mayImport names ${target}, which is not a ${profile} tier`);
    }
    for (const kind of m.appKinds[profile]) {
      const owners = m.slots.filter((s) => s.profiles.includes(profile) && s.appKind === kind);
      if (owners.length !== 1) bad.push(`${profile} app kind ${kind} must have exactly one slot (found ${owners.length})`);
    }
  }
  const major = Number(m.version.split('.')[0]);
  if (String(m.schema) !== `starci/hfs-slots@${major}`) bad.push(`schema ${m.schema} does not carry the major of version ${m.version}`);
  return bad;
}

/**
 * The parsed and validated manifest. `text` (or `file`, or `root`) selects the source; the default is the runtime's own
 * knowledge/hfs/slots.yaml. A manifest that fails its shape or a semantic rule is refused whole (HFS_MANIFEST_INVALID).
 */
export function loadSlotManifest({ root = skillRoot, file = path.join(root, HFS_MANIFEST_FILE), text } = {}) {
  let doc;
  try { doc = parseYaml(text ?? fs.readFileSync(file, 'utf8')); } catch (error) { fail('HFS_MANIFEST_INVALID', `the slot manifest cannot be read (${String(error?.message ?? error).split('\n')[0]})`, { file }); }
  const problems = manifestShapeProblems(doc);
  if (!problems.length) problems.push(...manifestSemanticProblems(doc));
  if (problems.length) fail('HFS_MANIFEST_INVALID', `the slot manifest breaks its schema: ${problems.slice(0, 5).join('; ')}${problems.length > 5 ? `; and ${problems.length - 5} more` : ''}`, { file, problems });
  const [major, minor, patch] = doc.version.split('.').map(Number);
  return Object.freeze({ ...doc, major, minor, patch });
}

// ------------------------------------------------------------------------------------- declaration

/** Shape problems of a parsed hfs.json, in the words of modules/schemas/hfs-repo.schema.yaml. */
function declarationShapeProblems(d) {
  const bad = [];
  if (!isPlainObject(d)) return ['hfs.json is not an object'];
  for (const key of Object.keys(d)) if (!['hfs', 'profile', 'project', 'apps', 'optionalSlots', 'connections', 'stacks'].includes(key)) bad.push(`unknown key ${key}`);
  if (!(Number.isInteger(d.hfs) && d.hfs >= 1)) bad.push('hfs must be the pinned manifest major (an integer, 1 or more)');
  if (!PROFILES.includes(d.profile)) bad.push('profile must be be or fe');
  if (!NAME.test(String(d.project))) bad.push('project must be a project name');
  if (!Array.isArray(d.apps) || !d.apps.length) bad.push('apps must list every apps/<name> with its kind');
  else d.apps.forEach((app, i) => {
    if (!isPlainObject(app) || !NAME.test(String(app.name)) || !NAME.test(String(app.kind)) || Object.keys(app).some((k) => k !== 'name' && k !== 'kind')) bad.push(`apps[${i}] must be {name, kind}`);
  });
  if (d.stacks !== undefined && (d.profile !== 'fe' || typeof d.stacks !== 'string' || !d.stacks || /^([a-zA-Z]:)?[\/]/.test(d.stacks))) bad.push('stacks is front end only and must be a relative path to the sibling back-end repository');
  if (d.optionalSlots !== undefined && (!Array.isArray(d.optionalSlots) || !d.optionalSlots.every((v) => SLOT_ID.test(String(v))) || new Set(d.optionalSlots).size !== d.optionalSlots.length)) bad.push('optionalSlots must be a unique list of slot ids');
  if (d.connections !== undefined) {
    // One physical database = one entry (R84): {name, envPrefix}; names and env prefixes unique, no prefix inside another's keys.
    const list = Array.isArray(d.connections) ? d.connections : null;
    if (!list || !list.every((c) => isPlainObject(c) && NAME.test(String(c.name)) && ENV_PREFIX.test(String(c.envPrefix)) && Object.keys(c).length === 2)) bad.push('connections must be a list of {name: kebab-case database name, envPrefix: UPPER_SNAKE prefix of its env keys}');
    else {
      if (new Set(list.map((c) => c.name)).size !== list.length) bad.push('connections names must be unique');
      for (const a of list) for (const b of list) if (a !== b && `${b.envPrefix}_`.startsWith(`${a.envPrefix}_`)) bad.push(`connections ${a.name} and ${b.name} share env keys (${a.envPrefix}_ covers ${b.envPrefix}_)`);
    }
  }
  if (d.profile === 'fe' && d.connections !== undefined) bad.push('connections belong to a backend repository');
  return bad;
}

const declarationInvalid = (problems, file) => fail('HFS_DECLARATION_INVALID', `hfs.json is refused: ${problems.slice(0, 5).join('; ')}${problems.length > 5 ? `; and ${problems.length - 5} more` : ''}`, { file, problems });

/**
 * A declaration checked against the manifest: the pinned major must be the manifest's (HFS_MANIFEST_MAJOR_MISMATCH
 * otherwise, and there is no compatibility window), app kinds must exist for the profile, optionalSlots may name only
 * opt-in slots that no app kind implies, and every required app kind must be declared.
 */
export function resolveRepoDeclaration(manifest, declaration, { file = HFS_DECLARATION_FILE } = {}) {
  const problems = declarationShapeProblems(declaration);
  if (problems.length) declarationInvalid(problems, file);
  if (declaration.hfs !== manifest.major)
    fail('HFS_MANIFEST_MAJOR_MISMATCH', `hfs.json pins manifest major ${declaration.hfs} but the manifest is ${manifest.version}`, { pinned: declaration.hfs, manifest: manifest.version, manifestMajor: manifest.major, file });
  const { profile } = declaration;
  const bad = [];
  const names = new Set();
  for (const app of declaration.apps) {
    if (names.has(app.name)) bad.push(`app ${app.name} is declared twice`);
    names.add(app.name);
    if (!manifest.appKinds[profile].includes(app.kind)) bad.push(`app ${app.name} has kind ${app.kind}, which is not a ${profile} kind (${manifest.appKinds[profile].join(', ')})`);
  }
  for (const id of declaration.optionalSlots ?? []) {
    const slot = manifest.slots.find((s) => s.id === id);
    if (!slot || !slot.profiles.includes(profile)) bad.push(`optionalSlots names ${id}, which is not a ${profile} slot`);
    else if (slot.presence !== 'opt-in') bad.push(`optionalSlots names ${id}, which is ${slot.presence}, not opt-in`);
    else if (slot.appKind !== undefined) bad.push(`optionalSlots names ${id}; an app of kind ${slot.appKind} enables it`);
  }
  const connections = declaration.connections ?? [];
  for (const slot of manifest.slots) {
    if (slot.appKind === undefined || !slot.profiles.includes(profile) || slot.presence !== 'required') continue;
    if (slot.requiredWhen === 'connections' && !connections.length) continue;
    if (!declaration.apps.some((a) => a.kind === slot.appKind)) bad.push(`no app of kind ${slot.appKind} is declared (${slot.id} is required${slot.requiredWhen ? ' once a connection is declared' : ''})`);
  }
  if (bad.length) declarationInvalid(bad, file);
  return Object.freeze({
    hfs: declaration.hfs,
    profile,
    project: declaration.project,
    apps: Object.freeze(declaration.apps.map((a) => Object.freeze({ name: a.name, kind: a.kind }))),
    optionalSlots: Object.freeze([...(declaration.optionalSlots ?? [])]),
    connections: Object.freeze(connections.map((c) => Object.freeze({ name: c.name, envPrefix: c.envPrefix }))),
    manifestVersion: manifest.version,
  });
}

/** hfs.json of the repository at `repoRoot`, parsed and resolved; a missing or unreadable file is a refusal, never "unavailable". */
export function readRepoDeclaration(manifest, repoRoot) {
  const file = path.join(repoRoot, HFS_DECLARATION_FILE);
  let declaration;
  try { declaration = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { declarationInvalid([`hfs.json cannot be read (${String(error?.code ?? error?.message ?? error).split('\n')[0]})`], file); }
  return resolveRepoDeclaration(manifest, declaration, { file });
}

// ------------------------------------------------------------------------------------------- resolver

const isEntryFile = (name) => name === 'index.ts' || name === 'index.tsx';

/**
 * The four questions for one repository. `repo` comes from resolveRepoDeclaration / readRepoDeclaration.
 * Paths are repository-relative (backslashes and a leading ./ are folded); a trailing / or a directory path is fine.
 */
export function createSlotResolver(manifest, repo) {
  const profile = repo.profile;
  const slots = manifest.slots.filter((s) => s.profiles.includes(profile));
  const byId = new Map(slots.map((s) => [s.id, s]));
  const variants = slots.flatMap(variantsOf);
  const appKind = new Map(repo.apps.map((a) => [a.name, a.kind]));

  const slotEnabled = (slot) => {
    if (slot.presence !== 'opt-in') return true;
    return slot.appKind !== undefined ? repo.apps.some((a) => a.kind === slot.appKind) : repo.optionalSlots.includes(slot.id);
  };
  const clean = (p) => posixPath(p).replace(/\/+$/, '');

  /** Every variant matching `p`, with its root and bindings, minus app-kind slots of another kind. */
  function matches(p, only) {
    const found = [];
    for (const variant of variants) {
      if (only && !only(variant.slot)) continue;
      const m = variant.regex.exec(p);
      if (!m) continue;
      const bindings = {};
      variant.names.forEach((name, i) => { bindings[name] = m[i + 2]; });
      if (variant.slot.appKind !== undefined && appKind.get(bindings.app) !== variant.slot.appKind) continue;
      const root = variant.dir ? m[1] : path.posix.dirname(m[1]);
      found.push({ variant, slot: variant.slot, root: root === '.' ? '' : root, bindings });
    }
    return found.sort((a, b) => b.variant.score - a.variant.score || a.variant.wildcards - b.variant.wildcards);
  }
  const best = (found) => {
    if (!found.length) return { hit: null, ambiguous: [] };
    const top = found.filter((f) => f.variant.score === found[0].variant.score && f.variant.wildcards === found[0].variant.wildcards);
    const distinct = [...new Set(top.map((f) => f.slot.id))];
    return distinct.length > 1 ? { hit: null, ambiguous: distinct } : { hit: top[0], ambiguous: [] };
  };

  /** The leading segments of `p` a variant accepts, and how far it got; how the nearest slot of an unknown path is found. */
  function nearest(p) {
    const parts = p.split('/');
    let winner = null;
    for (const variant of variants) {
      let depth = 0;
      while (depth < parts.length && depth < variant.segments.length) {
        const rx = variant.segmentRegexes[depth];
        if (rx === null || !rx.test(parts[depth])) break;
        depth += 1;
      }
      const expected = variant.segments[depth] ?? '';
      const distance = levenshtein(parts[depth] ?? '', expected.replace(VAR, ''));
      const shape = Math.abs(variant.segments.length - parts.length);
      const cand = { variant, depth, shape, distance };
      const better = !winner || depth > winner.depth || (depth === winner.depth && (shape < winner.shape || (shape === winner.shape && (distance < winner.distance || (distance === winner.distance && variant.score > winner.variant.score)))));
      if (better) winner = cand;
    }
    if (!winner) return null;
    return {
      slot: winner.variant.slot.id,
      pattern: winner.variant.pattern,
      matchedDepth: winner.depth,
      matchedPrefix: parts.slice(0, winner.depth).join('/'),
      expectedNext: winner.variant.segments[winner.depth] ?? null,
    };
  }

  /**
   * The folder kind of a file: the layer or kind folder its slot names (`layers`, `kinds`) that the file sits in. A slot whose
   * path spells the choice (`components/{blocks,leaves}/<name>/`) answers from the matched pattern; a slot that owns a whole
   * directory (`packages/<family>-ui/`) answers from the first folder below its root that the list names.
   */
  function kindOf({ variant, slot, root }, p) {
    const names = [...(slot.layers ?? []), ...(slot.kinds ?? [])];
    if (!names.length) return null;
    const literal = variant.segments.find((segment) => names.includes(segment));
    if (literal) return literal;
    const below = root ? p.slice(root.length + 1) : p;
    return below.split('/').slice(0, -1).find((segment) => names.includes(segment)) ?? null;
  }

  /** The role of a file in its slot: the entry of `roles` whose file name (variables filled from the path) is the file's name. */
  function roleOf(slot, bindings, p) {
    const name = p.split('/').pop();
    for (const [role, file] of Object.entries(slot.roles ?? {})) if (fillVars(file, bindings) === name) return role;
    return null;
  }

  /**
   * status: owned | forbidden (external slot) | not-enabled (opt-in slot the repository did not declare) | ambiguous
   * (two slots of equal specificity; a manifest gap) | no-slot (code HFS_SLOT_UNDECLARED, with the nearest slot).
   */
  function classifyPath(input) {
    const p = clean(input);
    const { hit, ambiguous } = best(matches(p));
    if (ambiguous.length) return { path: p, status: 'ambiguous', candidates: ambiguous };
    if (!hit) return { path: p, status: 'no-slot', code: 'HFS_SLOT_UNDECLARED', nearest: nearest(p) };
    const { slot, root, bindings } = hit;
    const status = slot.presence === 'forbidden' ? 'forbidden' : (slotEnabled(slot) ? 'owned' : 'not-enabled');
    const kind = kindOf(hit, p);
    const role = roleOf(slot, bindings, p);
    return { path: p, status, slot: slot.id, root, bindings, ...(kind ? { kind } : {}), ...(role ? { role } : {}), presence: slot.presence, tracking: slot.tracked, ...(status === 'forbidden' ? { goesTo: slot.goesTo } : {}) };
  }

  const slotOf = (p) => { const c = classifyPath(p); return c.slot ? byId.get(c.slot) : null; };

  /** The owner unit of `p`: the most specific owner slot instance containing it (a slot's own root when it owns nothing). */
  function ownerOf(input) {
    const p = clean(input);
    const { hit } = best(matches(p, (s) => s.owner === true));
    return hit ? { slot: hit.slot.id, root: hit.root, bindings: hit.bindings } : null;
  }

  /** The tier of `p` in the direction matrix: its slot's tier, the owner's for an inheriting slot, none for an untiered one; null when no slot owns it. */
  function tierOf(input) {
    const c = classifyPath(input);
    if (!c.slot) return null;
    const tier = byId.get(c.slot).tier;
    if (tier !== 'inherit') return tier;
    const owner = ownerOf(input);
    return owner ? byId.get(owner.slot).tier : 'none';
  }

  const layerIndex = (slot, root) => (slot.layers ? slot.layers.findIndex((layer) => root.split('/').includes(layer)) : -1);

  /**
   * Whether `fromPath` may import `toPath`: {allowed, reason, ...}. Reasons: sameOwner, untiered, crossApp,
   * tierDirection, layerOrder, notPublicEntry, allowed, slotForbidden, slotNotEnabled, slotAmbiguous, and unowned (HFS_SLOT_UNDECLARED for the path no slot owns).
   * Cycles are a graph property and belong to the architecture check, not to one edge.
   */
  function importAllowed(fromPath, toPath) {
    const from = classifyPath(fromPath);
    const to = classifyPath(toPath);
    for (const side of [from, to]) if (side.status === 'no-slot') return { allowed: false, reason: 'unowned', code: side.code, path: side.path, nearest: side.nearest };
    for (const side of [from, to]) if (side.status !== 'owned') return { allowed: false, reason: `slot${side.status[0].toUpperCase()}${side.status.slice(1).replace(/-(.)/g, (_, c) => c.toUpperCase())}`, path: side.path, slot: side.slot };
    const fromTier = tierOf(from.path);
    const toTier = tierOf(to.path);
    if (fromTier === 'none' || toTier === 'none') return { allowed: true, reason: 'untiered' };
    if (from.bindings.app !== undefined && to.bindings.app !== undefined && from.bindings.app !== to.bindings.app)
      return { allowed: false, reason: 'crossApp', from: from.bindings.app, to: to.bindings.app };
    const fromOwner = ownerOf(from.path);
    const toOwner = ownerOf(to.path);
    const unit = (side, owner) => (owner ? `${owner.slot}:${owner.root}` : `${side.slot}:${side.root}`);
    if (unit(from, fromOwner) === unit(to, toOwner)) return { allowed: true, reason: 'sameOwner' };
    if (!manifest.tiers[profile][fromTier]?.mayImport.includes(toTier)) return { allowed: false, reason: 'tierDirection', fromTier, toTier, mayImport: manifest.tiers[profile][fromTier]?.mayImport ?? [] };
    if (manifest.tiers[profile][fromTier].lowerLayerOnly && fromTier === toTier) {
      const fromSlot = byId.get((fromOwner ?? from).slot);
      const a = layerIndex(fromSlot, fromOwner?.root ?? from.root);
      const b = layerIndex(byId.get((toOwner ?? to).slot), toOwner?.root ?? to.root);
      if (a >= 0 && b >= 0 && b <= a) return { allowed: false, reason: 'layerOrder', fromLayer: fromSlot.layers[a], toLayer: fromSlot.layers[b] };
    }
    if (toOwner) {
      const relative = to.path === toOwner.root ? '' : to.path.slice(toOwner.root.length + 1);
      const ownerTier = byId.get(toOwner.slot).tier;
      const entry = isEntryFile(relative) || (ownerTier === 'package' && relative === 'src/index.ts') || (ownerTier === 'app' && relative === 'app.module.ts');
      if (!entry) return { allowed: false, reason: 'notPublicEntry', owner: toOwner.root, path: to.path };
    }
    return { allowed: true, reason: 'allowed', fromTier, toTier };
  }

  const fillVars = (text, bindings) => String(text).replace(VAR, (whole, name) => bindings[name] ?? whole);

  /** The files and directories the instance holding `p` must contain (directories end with /); {path} entries are repo-relative. */
  function requiredFiles(input) {
    const c = classifyPath(input);
    if (!c.slot) return [];
    const slot = byId.get(c.slot);
    return (slot.requires ?? []).map((entry) => {
      const rooted = entry.startsWith('/');
      const filled = fillVars(rooted ? entry.slice(1) : entry, c.bindings);
      return rooted || !c.root ? filled : `${c.root}/${filled}`;
    });
  }

  /**
   * What the repository must contain, without walking it: {paths: [{slot, path, via}], minimums: [{slot, min}]}.
   * via is slot (a fixed path), instance (a requiredInstances or app-kind root) or requires (a file an instance needs).
   */
  function requiredPaths() {
    const paths = [];
    const minimums = [];
    const expandApps = (slot) => repo.apps.filter((a) => slot.appKind === undefined || a.kind === slot.appKind);
    for (const slot of slots) {
      if (slot.presence !== 'required') continue;
      if (slot.requiredWhen === 'connections' && !repo.connections.length) continue;
      if (slot.minInstances) minimums.push({ slot: slot.id, min: slot.minInstances, ...(slot.appKind ? { appKind: slot.appKind } : {}) });
      for (const variant of braceVariants(slot.path)) {
        const names = [...new Set(varsOf(variant))];
        const fixed = { ...(slot.requiredInstances ?? {}) };
        const open = names.filter((n) => n !== 'app' && !(n in fixed));
        if (open.length) continue;            // an instance-level slot: its instances are found by walking the tree
        const combos = [{}];
        const grow = (name, values) => { const next = []; for (const c of combos) for (const v of values) next.push({ ...c, [name]: v }); combos.splice(0, combos.length, ...next); };
        if (names.includes('app')) grow('app', expandApps(slot).map((a) => a.name));
        for (const [name, values] of Object.entries(fixed)) grow(name, values);
        const isInstance = names.length > 0;
        for (const bindings of combos) {
          const target = fillVars(variant, bindings);
          paths.push({ slot: slot.id, path: target, via: isInstance ? 'instance' : 'slot' });
          const root = target.endsWith('/') ? target.slice(0, -1) : path.posix.dirname(target);
          for (const entry of slot.requires ?? []) {
            const rooted = entry.startsWith('/');
            const filled = fillVars(rooted ? entry.slice(1) : entry, bindings);
            paths.push({ slot: slot.id, path: rooted || !root || root === '.' ? filled : `${root}/${filled}`, via: 'requires' });
          }
        }
      }
    }
    const seen = new Set();
    return { paths: paths.filter((p) => { const key = `${p.slot}|${p.path}`; if (seen.has(key)) return false; seen.add(key); return true; }), minimums };
  }

  /** tracked | ignored | external for the slot owning `p`, or null when no slot owns it. */
  const trackingOf = (p) => classifyPath(p).tracking ?? null;
  /** True only for a path a slot owns and requires to be committed. */
  const isTracked = (p) => trackingOf(p) === 'tracked';

  return Object.freeze({
    repo,
    slot: (id) => byId.get(id) ?? null,
    slots: () => slots,
    slotEnabled,
    classifyPath,
    slotOf,
    ownerOf,
    tierOf,
    importAllowed,
    requiredFiles,
    requiredPaths,
    trackingOf,
    isTracked,
    ruleParams: () => ruleParams(manifest, profile),
    allowedImports: (tier) => manifest.tiers[profile][tier]?.mayImport ?? null,
  });
}

/** The rule parameters of one profile (be: fileLines, duplicateBlock, infraOwners, suffixes, bannedSuffixes; fe: fileLines, duplicateBlock), as a frozen deep copy. */
export function ruleParams(manifest, profile) {
  if (!PROFILES.includes(profile)) fail('HFS_MANIFEST_INVALID', `ruleParams has no profile ${profile}`, { profile });
  const deepFreeze = (v) => { if (v && typeof v === 'object') Object.values(v).forEach(deepFreeze); return Object.freeze(v); };
  return deepFreeze(structuredClone(manifest.ruleParams[profile]));
}

/** The manifest of this runtime plus the resolver for the repository at `repoRoot` (or for an already-parsed declaration). */
export function openHfs({ root = skillRoot, repoRoot, declaration, manifest = loadSlotManifest({ root }) } = {}) {
  const repo = declaration !== undefined ? resolveRepoDeclaration(manifest, declaration) : readRepoDeclaration(manifest, repoRoot);
  return { manifest, repo, ...createSlotResolver(manifest, repo), rules: () => loadRuleCatalog({ root, manifest }) };
}

// ------------------------------------------------------------------------------------------ rule catalog

export const HFS_RULES_FILE = 'knowledge/hfs/rules.yaml';
export const RULE_GATES = Object.freeze(['pre-commit', 'pre-push', 'settle', 'land', 'ci', 'sonar']);
export const ENFORCER_FAMILIES = Object.freeze(['eslint-be', 'eslint-fe', 'stylelint', 'machine', 'hfs', 'work-validate', 'sonar']);
export const RULE_KINDS = Object.freeze(['codemod', 'lint', 'check', 'design']);
const FINDING_CODE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;
const ENFORCER_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const FILE_ENFORCERS = ['machine', 'hfs', 'work-validate', 'sonar'];

/** Shape and semantic problems of a parsed knowledge/hfs/rules.yaml, in the words of modules/schemas/hfs-rules.schema.yaml. */
function ruleCatalogProblems(d) {
  const bad = [];
  if (!isPlainObject(d)) return ['the rule catalog is not a map'];
  for (const key of Object.keys(d)) if (!['schema', 'version', 'gates', 'enforcerKinds', 'rules'].includes(key)) bad.push(`unknown top-level key ${key}`);
  const schemaOk = /^starci\/hfs-rules@\d+$/.test(String(d.schema));
  if (!schemaOk) bad.push('schema must be starci/hfs-rules@<major>');
  if (!SEMVER.test(String(d.version))) bad.push('version must be MAJOR.MINOR.PATCH');
  else if (schemaOk && d.schema.split('@')[1] !== d.version.split('.')[0]) bad.push('the major of version must equal the number after @ in schema');
  const vocabulary = (key, names) => {
    if (!isPlainObject(d[key])) { bad.push(`${key} must be a map`); return; }
    if (JSON.stringify(Object.keys(d[key])) !== JSON.stringify(names)) bad.push(`${key} must list exactly ${names.join(', ')} in that order`);
    for (const [name, text] of Object.entries(d[key])) if (typeof text !== 'string' || !text.trim()) bad.push(`${key}.${name} needs a description`);
  };
  vocabulary('gates', RULE_GATES);
  vocabulary('enforcerKinds', ENFORCER_FAMILIES);
  if (!Array.isArray(d.rules) || !d.rules.length) { bad.push('rules must be a non-empty list'); return bad; }
  const codeOwner = new Map();
  d.rules.forEach((r, index) => {
    const at = `rules[${index}]`;
    if (!isPlainObject(r)) { bad.push(`${at} is not a map`); return; }
    const label = typeof r.id === 'string' ? r.id : at;
    for (const key of Object.keys(r)) if (!['id', 'code', 'title_vi', 'law', 'kinds', 'gates', 'failureCodes', 'enforcers'].includes(key)) bad.push(`${label} has unknown key ${key}`);
    const expectedId = `R${String(index + 1).padStart(2, '0')}`;
    if (!/^R\d{2}$/.test(String(r.id))) bad.push(`${at}.id must be R<two digits>`);
    else if (r.id !== expectedId) bad.push(`${label} is out of order: ${at} must be ${expectedId}`);
    if (!FINDING_CODE.test(String(r.code))) bad.push(`${label}.code must be an UPPER_SNAKE finding code`);
    for (const key of ['title_vi', 'law']) if (typeof r[key] !== 'string' || !r[key].trim()) bad.push(`${label}.${key} is missing`);
    if (typeof r.law === 'string' && r.law.includes('\n')) bad.push(`${label}.law must be one line`);
    const enumList = (key, allowed) => {
      if (!Array.isArray(r[key]) || !r[key].length) { bad.push(`${label}.${key} must be a non-empty list`); return []; }
      for (const v of r[key]) if (!allowed.includes(v)) bad.push(`${label}.${key} has ${JSON.stringify(v)}, not one of ${allowed.join(', ')}`);
      if (new Set(r[key]).size !== r[key].length) bad.push(`${label}.${key} repeats a value`);
      return r[key];
    };
    enumList('kinds', RULE_KINDS);
    const gates = enumList('gates', RULE_GATES);
    if (gates.length) {
      if (!gates.includes('land')) bad.push(`${label} must run at the land gate (every rule does)`);
      if (gates.includes('pre-commit') && !gates.includes('pre-push')) bad.push(`${label} runs at pre-commit, so it also runs at pre-push`);
    }
    if (!Array.isArray(r.failureCodes) || !r.failureCodes.length || !r.failureCodes.every((c) => FINDING_CODE.test(String(c)))) bad.push(`${label}.failureCodes must be a non-empty list of UPPER_SNAKE codes`);
    else {
      if (r.failureCodes[0] !== r.code) bad.push(`${label}.failureCodes must start with the rule's own code ${r.code}`);
      if (new Set(r.failureCodes).size !== r.failureCodes.length) bad.push(`${label}.failureCodes repeats a code`);
      for (const c of r.failureCodes) {
        if (codeOwner.has(c) && codeOwner.get(c) !== label) bad.push(`${label} names ${c}, which ${codeOwner.get(c)} already owns`);
        codeOwner.set(c, label);
      }
    }
    if (!Array.isArray(r.enforcers) || !r.enforcers.length) { bad.push(`${label}.enforcers must name at least one enforcer`); return; }
    const seen = new Set();
    r.enforcers.forEach((e, n) => {
      const eat = `${label}.enforcers[${n}]`;
      if (!isPlainObject(e)) { bad.push(`${eat} is not a map`); return; }
      for (const key of Object.keys(e)) if (!['kind', 'id', 'status', 'at'].includes(key)) bad.push(`${eat} has unknown key ${key}`);
      if (!ENFORCER_FAMILIES.includes(e.kind)) bad.push(`${eat}.kind must be one of ${ENFORCER_FAMILIES.join(', ')}`);
      if (!ENFORCER_ID.test(String(e.id))) bad.push(`${eat}.id must be kebab-case`);
      if (seen.has(`${e.kind}:${e.id}`)) bad.push(`${eat} repeats ${e.kind}:${e.id}`);
      seen.add(`${e.kind}:${e.id}`);
      if (e.status !== undefined && e.status !== 'planned') bad.push(`${eat}.status is either absent or planned`);
      if (e.at !== undefined) {
        if (typeof e.at !== 'string' || !e.at.trim() || e.at.startsWith('/') || e.at.includes('..')) bad.push(`${eat}.at must be a repository-relative path`);
        if (e.status === 'planned') bad.push(`${eat} is planned, so it has no file yet (at)`);
        if (!FILE_ENFORCERS.includes(e.kind)) bad.push(`${eat}.at belongs to a machine, hfs, work-validate or sonar enforcer only`);
      } else if (FILE_ENFORCERS.includes(e.kind) && e.status !== 'planned') bad.push(`${eat} exists, so it names the file (at) that emits its code`);
    });
    if (Array.isArray(r.gates)) {
      const hasSonar = r.enforcers.some((e) => isPlainObject(e) && e.kind === 'sonar');
      if (r.gates.includes('sonar') !== hasSonar) bad.push(`${label}: the sonar gate and a sonar enforcer go together`);
    }
  });
  return bad;
}

const deepFreeze = (v) => { if (v && typeof v === 'object') Object.values(v).forEach(deepFreeze); return Object.freeze(v); };

/**
 * The parsed and validated HFS rule catalog. `text` (or `file`, or `root`) selects the source; the default is the runtime's
 * own knowledge/hfs/rules.yaml. A catalog that breaks its shape or a semantic rule is refused whole (HFS_RULES_INVALID), and
 * so is one whose major differs from the slot manifest passed as `manifest` (HFS_MANIFEST_MAJOR_MISMATCH).
 * Answers: rule(id), byCode(code), forGate(gate), forEnforcer(kind, id), planned() and unbuilt().
 */
export function loadRuleCatalog({ root = skillRoot, file = path.join(root, HFS_RULES_FILE), text, manifest } = {}) {
  let doc;
  try { doc = parseYaml(text ?? fs.readFileSync(file, 'utf8')); } catch (error) { fail('HFS_RULES_INVALID', `the rule catalog cannot be read (${String(error?.message ?? error).split('\n')[0]})`, { file }); }
  const problems = ruleCatalogProblems(doc);
  if (problems.length) fail('HFS_RULES_INVALID', `the rule catalog breaks its schema: ${problems.slice(0, 5).join('; ')}${problems.length > 5 ? `; and ${problems.length - 5} more` : ''}`, { file, problems });
  const [major, minor, patch] = doc.version.split('.').map(Number);
  if (manifest && manifest.major !== major) fail('HFS_MANIFEST_MAJOR_MISMATCH', `the rule catalog is major ${major} but the slot manifest is major ${manifest.major}`, { catalog: major, manifest: manifest.major });
  const list = deepFreeze(doc.rules.map((r) => ({ ...r, enforcers: r.enforcers.map((e) => ({ ...e, planned: e.status === 'planned' })) })));
  const byId = new Map(list.map((r) => [r.id, r]));
  const byCode = new Map(list.flatMap((r) => r.failureCodes.map((c) => [c, r])));
  return Object.freeze({
    version: doc.version, major, minor, patch,
    gates: deepFreeze(structuredClone(doc.gates)),
    enforcerKinds: deepFreeze(structuredClone(doc.enforcerKinds)),
    rules: list,
    /** The rule with this id (R01..), or null. */
    rule: (id) => byId.get(id) ?? null,
    /** The rule that owns this failure code (its own or a sub-check code), or null. */
    byCode: (code) => byCode.get(code) ?? null,
    /** The rules that run at a gate. */
    forGate: (gate) => list.filter((r) => r.gates.includes(gate)),
    /** The catalogued why code of a lint finding's rule id (`starci-be/<id>`, `starci-fe/<id>`), or undefined. */
    lintCode: (ruleId) => {
      const [plugin, id] = String(ruleId ?? '').split('/');
      const kind = plugin === 'starci-be' ? 'eslint-be' : plugin === 'starci-fe' ? 'eslint-fe' : null;
      return kind ? list.find((r) => r.enforcers.some((e) => e.kind === kind && e.id === id))?.code : undefined;
    },
    /** The rules one enforcer judges, e.g. forEnforcer('eslint-be', 'error-home'). */
    forEnforcer: (kind, id) => list.filter((r) => r.enforcers.some((e) => e.kind === kind && e.id === id)),
    /** Every enforcer still owed, as {rule, kind, id}. */
    planned: () => list.flatMap((r) => r.enforcers.filter((e) => e.planned).map((e) => ({ rule: r.id, kind: e.kind, id: e.id }))),
    /** The rules with no existing enforcer at all. */
    unbuilt: () => list.filter((r) => r.enforcers.every((e) => e.planned)),
  });
}

/** The rules of this runtime's catalog, frozen, in id order. */
export const rules = (options) => loadRuleCatalog(options).rules;
