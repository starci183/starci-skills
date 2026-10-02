// hfs-slots.mjs - the HFS slot manifest and app declaration, loaded once and asked four questions:
//   which slot owns path P           slotOf(P) / classifyPath(P)   (an unknown path reports its nearest slot)
//   is import A -> B allowed         importAllowed(A, B)           (tier matrix, cross-owner entry, cross-app, layers)
//   which files are required         requiredFiles(P) / requiredPaths()
//   is this path tracked             isTracked(P) / trackingOf(P); the rule catalog (knowledge/hfs/rules.yaml, modules/schemas/hfs-rules.schema.yaml) loads through loadRuleCatalog / rules().
// Every check and lint rule of HFS reads knowledge/hfs/slots.yaml through this module; none keeps its own path
// list. The manifest shape is modules/schemas/hfs-slots.schema.yaml and hfs.json is modules/schemas/hfs-repo.schema.yaml;
// the installed runtime carries no npm dependency, so this file re-states those shapes instead of loading ajv (tests/hfs/hfs-slots.spec.mjs proves the two agree).
//
// A product is ONE app repository: hfs.json at the app root has kind `app` and declares its two sides, `be` and `fe`, each in
// the folder of that name. The resolver of the app answers for the whole tree: a root path with the slots of profile `app`,
// a path below a side folder with that side's resolver (profile be or fe, the side folder as its root: the side view), so
// every check and lint rule runs unchanged with a side folder as its repository root. Nothing crosses sides except the
// paths the declaration lists in `sides.<side>.reads` (a subset of the manifest's `sides.<side>.reads`).
//
// One loader, two manifest kinds. `kind: app` (the default; knowledge/hfs/slots.yaml) is the product standard above.
// `kind: runtime` (knowledge/hfs/runtime-slots.yaml, schema starci/runtime-slots@<major>) is the standard of the StarCi
// runtime repository itself: one profile `runtime`, no sides and no app kinds, slot ids runtime.<name>, the tracked value
// `generated` (a copy written only by the slot's `generatedBy`). A runtime repository declares itself with
// hfs.json {"hfs": <major>, "kind": "runtime", "project": <name>}.
import { ruleParamsProblems } from './rule-params-shape.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { braceVariants, globExpression } from '../lib/glob.mjs';
import { posixPath } from '../lib/path-key.mjs';
import { captureNames } from '../lib/i18n.mjs';
import { isPlainObject } from '../../engine/plain-object.mjs';
import { APP_KIND, EDITIONS, ENV_PREFIX, MANIFEST_KINDS, NAME, PRESENCE, RUNTIME_KIND, SEMVER, TESTS, TRACKED, manifestKind, runtimeSemanticProblems, runtimeShapeProblems, slotProblems, tierMapProblems } from './manifest-shape.mjs';
import { declaredSlotEnabled, optionalSlotProblems, triggerProblems } from './declaration-slots.mjs';
import { declarationShapeProblems } from './declaration-shape.mjs';
import { declarationEdition, editionRuleParams, effectiveSlot, enforcerJudgedInEdition, judgedInEdition, litePresenceOf, ruleEditionProblems, slotInEdition } from './edition-slots.mjs';
export { litePresenceOf, slotInEdition } from './edition-slots.mjs';
export const HFS_MANIFEST_FILE = 'knowledge/hfs/slots.yaml';
/** The manifest of kind runtime: the standard tree of the StarCi runtime repository (judged by scripts/hfs/runtime-check.mjs). */
export const RUNTIME_MANIFEST_FILE = 'knowledge/hfs/runtime-slots.yaml';
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

/** The sides of an app; each lives in the folder of its name and is the profile of its slots. */
const PROFILES = ['be', 'fe'];
export const SIDES = Object.freeze([...PROFILES]);
/** The profile of the app root's own slots. */
export const APP_SCOPE = 'app';

/**
 * The rewriter of a side's finding messages: `(message) => message` with its paths made app-relative like the finding's own path.
 * Every check and rule of a side judges the side folder as its root, so the paths it names (`apps/web/src/...`, `src/modules/...`,
 * `tsconfig.json`) are side-relative. A path here is a token that starts at a word boundary with a top-level entry of the side folder
 * (`sideRoot`, read once) and goes on with `/`, or is that entry when its name holds a dot (a file). An import specifier (`@/x`,
 * `../x`) or a path already app-relative is left alone.
 */
export function appRelativeMessages(side, sideRoot) {
  let entries = [];
  try { entries = fs.readdirSync(sideRoot).filter((name) => name !== 'node_modules' && !name.startsWith('.git')); } catch { /* no side folder: nothing to rewrite */ }
  if (!entries.length) return (message) => message;
  const escaped = entries.sort((a, b) => b.length - a.length).map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const token = new RegExp(`(^|[\\s'"\`(\\[{,;=<>])((?:${escaped.join('|')})(?=/|[\\s'"\`)\\]},;:!?<>]|\\.(?:\\s|$)|$))`, 'g');
  return (message) => (typeof message === 'string' && message
    ? message.replace(token, (whole, before, entry, offset) => (message.startsWith('/', offset + whole.length) || entry.includes('.') ? `${before}${side}/${entry}` : whole))
    : message);
}

const SCOPES = [APP_SCOPE, ...PROFILES];

// ------------------------------------------------------------------------------------------------ patterns

const VAR = /<([A-Za-z][A-Za-z0-9-]*)>/g;
const varsOf = (text) => captureNames(text, VAR);
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
  if (!MANIFEST_KINDS.includes(manifestKind(m))) return [`kind must be one of ${MANIFEST_KINDS.join(', ')}`];
  if (manifestKind(m) === RUNTIME_KIND) return runtimeShapeProblems(m);
  const allowed = new Set(['schema', 'kind', 'version', 'versioning', 'presenceValues', 'trackedValues', 'testValues', 'editions', 'sides', 'appKinds', 'triggerKinds', 'tiers', 'ruleParams', 'crossOwner', 'crossApp', 'slots', 'consumers', 'naming']);
  for (const key of Object.keys(m)) if (!allowed.has(key)) bad.push(`unknown top-level key ${key}`);
  if (!/^starci\/hfs-slots@\d+$/.test(String(m.schema))) bad.push('schema must be starci/hfs-slots@<major>');
  if (!SEMVER.test(String(m.version))) bad.push('version must be MAJOR.MINOR.PATCH');
  if (!isPlainObject(m.versioning) || !['patch', 'minor', 'major', 'retire', 'pins'].every((k) => typeof m.versioning[k] === 'string')) bad.push('versioning needs patch, minor, major, retire and pins text');
  if (JSON.stringify(m.presenceValues) !== JSON.stringify(PRESENCE)) bad.push(`presenceValues must be ${PRESENCE.join(', ')}`);
  if (JSON.stringify(m.trackedValues) !== JSON.stringify(TRACKED)) bad.push(`trackedValues must be ${TRACKED.join(', ')}`);
  if (JSON.stringify(m.testValues) !== JSON.stringify(TESTS)) bad.push(`testValues must be ${TESTS.join(', ')}`);
  if (JSON.stringify(m.editions) !== JSON.stringify(EDITIONS)) bad.push(`editions must be ${EDITIONS.join(', ')}`);
  if (!isPlainObject(m.sides) || Object.keys(m.sides).sort().join() !== PROFILES.join()) bad.push('sides must be a map with exactly be and fe');
  else for (const side of PROFILES) {
    const def = m.sides[side];
    if (!isPlainObject(def) || Object.keys(def).join() !== 'reads' || !Array.isArray(def.reads) || !def.reads.every((r) => typeof r === 'string' && /^[a-z][a-z0-9-]*\/([^/]+\/)+$/.test(r)) || new Set(def.reads).size !== def.reads.length) bad.push(`sides.${side} must be {reads: [unique <owner>/<dir>/ paths]}`);
  }
  if (m.triggerKinds !== undefined && (!Array.isArray(m.triggerKinds) || !m.triggerKinds.length || !m.triggerKinds.every((k) => NAME.test(String(k))) || new Set(m.triggerKinds).size !== m.triggerKinds.length)) bad.push('triggerKinds must be a non-empty list of unique names');
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
    bad.push(...tierMapProblems(profile, tiers));
  }
  bad.push(...ruleParamsProblems(m));
  if (!Array.isArray(m.slots) || !m.slots.length) { bad.push('slots must be a non-empty list'); return bad; }
  m.slots.forEach((slot, index) => bad.push(...slotProblems(slot, index, APP_KIND, { appScope: APP_SCOPE, scopes: SCOPES })));
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
      if (profile === APP_SCOPE) {
        // The app root holds no source: its slots take no part in import checks and describe no app.
        for (const key of ['appKind', 'owner', 'layers', 'kinds', 'composedBy', 'requiredWhen', 'requiredInstances']) if (slot[key] !== undefined) bad.push(`slot ${slot.id}: an app-root slot has no ${key}`);
        if (slot.tier !== 'none') bad.push(`slot ${slot.id}: an app-root slot has tier none`);
      } else {
        const tiers = m.tiers[profile];
        if (slot.tier !== 'none' && slot.tier !== 'inherit' && !(slot.tier in tiers)) bad.push(`slot ${slot.id}: tier ${slot.tier} is not a ${profile} tier`);
        if (slot.appKind !== undefined && !m.appKinds[profile].includes(slot.appKind)) bad.push(`slot ${slot.id}: app kind ${slot.appKind} is not a ${profile} kind`);
        bad.push(...triggerProblems(slot, m.triggerKinds));
      }
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
    if (!slotInEdition(m, slot, 'lite') && (slot.litePresence !== undefined || slot.lite !== undefined)) bad.push(`slot ${slot.id}: litePresence/lite on a slot lite never sees (editions)`);
    if (isPlainObject(slot.litePresence) && slot.profiles.includes(APP_SCOPE)) bad.push(`slot ${slot.id}: an app-root slot takes a bare litePresence, not a per-side map`);
    for (const profile of slot.profiles) if (litePresenceOf(slot, profile) === 'forbidden' && typeof slot.goesTo !== 'string') bad.push(`slot ${slot.id}: forbidden in lite for ${profile}, so it says where the content goes (goesTo)`);
    if (slot.lite?.path !== undefined) {
      for (const name of varsOf(slot.lite.path)) if (!pathVars.has(name)) bad.push(`slot ${slot.id}: lite.path binds <${name}>, which the path does not`);
      for (const variant of braceVariants(slot.lite.path)) {
        try { compileVariant(slot, variant); } catch (error) { bad.push(`slot ${slot.id}: lite.path ${variant} does not compile (${error.message})`); }
      }
    }
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
  if (manifestKind(m) === RUNTIME_KIND) return [...bad, ...runtimeSemanticProblems(m)];
  for (const side of PROFILES) for (const read of m.sides[side].reads) {
    const [owner, ...rest] = read.split('/');
    const below = rest.join('/');
    if (owner === side) bad.push(`sides.${side}.reads names ${read}, which is its own side`);
    // A side read is a path of the other side (be/contracts/); an app-root read (supabase/types/) names a tree an app slot owns.
    else if (PROFILES.includes(owner)) {
      if (!m.slots.some((s) => s.profiles.includes(owner) && s.presence !== 'forbidden' && braceVariants(s.path).some((v) => v.startsWith(below)))) bad.push(`sides.${side}.reads names ${read}, which no ${owner} slot owns`);
    } else if (!m.slots.some((s) => s.profiles.includes(APP_SCOPE) && s.presence !== 'forbidden' && braceVariants(s.path).some((v) => v.startsWith(read)))) bad.push(`sides.${side}.reads names ${read}, which no app-root slot owns`);
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

const declarationInvalid = (problems, file) => fail('HFS_DECLARATION_INVALID', `hfs.json is refused: ${problems.slice(0, 5).join('; ')}${problems.length > 5 ? `; and ${problems.length - 5} more` : ''}`, { file, problems });

/** One side of a declaration checked against the manifest: app kinds of the profile, opt-in slots, required app kinds, reads. */
function sideProblems(manifest, side, s) {
  const bad = [];
  for (const app of s.apps) if (!manifest.appKinds[side].includes(app.kind)) bad.push(`${side} app ${app.name} has kind ${app.kind}, which is not a ${side} kind (${manifest.appKinds[side].join(', ')})`);
  bad.push(...optionalSlotProblems(manifest, side, s));
  for (const read of s.reads ?? []) if (!manifest.sides[side].reads.includes(read)) bad.push(`sides.${side}.reads names ${read}; ${side} may read only ${manifest.sides[side].reads.join(', ') || 'nothing of the other side'}`);
  const connections = s.connections ?? [];
  for (const slot of manifest.slots) {
    if (slot.appKind === undefined || !slot.profiles.includes(side) || slot.presence !== 'required') continue;
    if (slot.requiredWhen === 'connections' && !connections.length) continue;
    if (!s.apps.some((a) => a.kind === slot.appKind)) bad.push(`no ${side} app of kind ${slot.appKind} is declared (${slot.id} is required${slot.requiredWhen ? ' once a connection is declared' : ''})`);
  }
  return bad;
}

/**
 * A declaration checked against the manifest: kind app, the pinned major the manifest's (HFS_MANIFEST_MAJOR_MISMATCH otherwise,
 * and there is no compatibility window), and per side: app kinds of that profile, optionalSlots naming only opt-in slots of the
 * side that no app kind implies, every required app kind declared, reads within the manifest's. Returns the app (profile app,
 * its two sides under `sides`), or with `side` that side's view: the declaration a check of the side folder runs under.
 */
export function resolveRepoDeclaration(manifest, declaration, { file = HFS_DECLARATION_FILE, side = null } = {}) {
  const problems = declarationShapeProblems(declaration, PROFILES);
  if (problems.length) declarationInvalid(problems, file);
  if (declaration.kind !== manifestKind(manifest)) declarationInvalid([`hfs.json is of kind ${declaration.kind}, but the manifest it is judged by is of kind ${manifestKind(manifest)}`], file);
  if (declaration.hfs !== manifest.major)
    fail('HFS_MANIFEST_MAJOR_MISMATCH', `hfs.json pins manifest major ${declaration.hfs} but the manifest is ${manifest.version}`, { pinned: declaration.hfs, manifest: manifest.version, manifestMajor: manifest.major, file });
  if (declaration.kind === RUNTIME_KIND) {
    if (side !== null) fail('HFS_DECLARATION_INVALID', 'a runtime repository has no sides', { file, side });
    return Object.freeze({
      hfs: declaration.hfs,
      kind: RUNTIME_KIND,
      project: declaration.project,
      side: null,
      profile: RUNTIME_KIND,
      apps: Object.freeze([]),
      optionalSlots: Object.freeze([]),
      connections: Object.freeze([]),
      reads: Object.freeze([]),
      manifestVersion: manifest.version,
    });
  }
  const { edition, known, valid } = declarationEdition(manifest, declaration);
  if (!valid) fail('HFS_EDITION_INVALID', `hfs.json edition is ${JSON.stringify(declaration.edition)}; the editions this manifest knows are ${known.join(', ')} (absent means full)`, { file, edition: declaration.edition });
  const bad = PROFILES.flatMap((name) => sideProblems(manifest, name, declaration.sides[name]));
  if (bad.length) declarationInvalid(bad, file);
  if (side !== null && !PROFILES.includes(side)) fail('HFS_DECLARATION_INVALID', `${side} is not a side of an app (be, fe)`, { file, side });
  // A provider declared on any connection enables the provider slots of every profile (a fe side declares none): each view carries the union.
  const providers = Object.freeze([...new Set(PROFILES.flatMap((name) => (declaration.sides[name].connections ?? []).map((c) => c.provider).filter((p) => p !== undefined)))]);
  const sides = Object.fromEntries(PROFILES.map((name) => {
    const s = declaration.sides[name];
    return [name, Object.freeze({
      hfs: declaration.hfs,
      kind: APP_KIND,
      project: declaration.project,
      edition,
      side: name,
      profile: name,
      apps: Object.freeze(s.apps.map((a) => Object.freeze({ name: a.name, kind: a.kind }))),
      optionalSlots: Object.freeze([...(s.optionalSlots ?? [])]),
      patterns: Object.freeze([...(s.patterns ?? [])]), kinds: Object.freeze([...(s.kinds ?? [])]),
      connections: Object.freeze((s.connections ?? []).map((c) => Object.freeze({ name: c.name, envPrefix: c.envPrefix, owner: c.owner, isolation: c.isolation, ...(c.provider !== undefined ? { provider: c.provider } : {}) }))),
      providers,
      reads: Object.freeze([...(s.reads ?? [])]),
      manifestVersion: manifest.version,
    })];
  }));
  if (side !== null) return sides[side];
  return Object.freeze({
    hfs: declaration.hfs,
    kind: APP_KIND,
    project: declaration.project,
    edition,
    side: null,
    profile: APP_SCOPE,
    // The root declares no app or connection of its own (each side does); its one opt-in slot is the browser journey (`browser: true`).
    apps: Object.freeze([]),
    optionalSlots: Object.freeze(declaration.browser === true ? ['app.browser'] : []),
    connections: Object.freeze([]),
    providers,
    reads: Object.freeze([]),
    sides: Object.freeze(sides),
    manifestVersion: manifest.version,
  });
}

/**
 * Where the declaration of `dir` lives: `dir` itself when it holds hfs.json (the app root), else its parent when `dir` is a side
 * folder (be/ or fe/) of an app (the side view). `{ file, appRoot, side }`; side is null at the app root.
 */
export function locateDeclaration(dir) {
  const own = path.join(dir, HFS_DECLARATION_FILE);
  if (fs.existsSync(own)) return { file: own, appRoot: dir, side: null };
  const parent = path.dirname(dir);
  const side = path.basename(dir);
  const up = path.join(parent, HFS_DECLARATION_FILE);
  if (PROFILES.includes(side) && fs.existsSync(up)) return { file: up, appRoot: parent, side };
  return { file: own, appRoot: dir, side: null };
}

/**
 * hfs.json of the app at `repoRoot` (the app itself), or of the app whose side folder `repoRoot` is (that side's view), parsed and
 * resolved; a missing or unreadable file is a refusal, never "unavailable".
 */
export function readRepoDeclaration(manifest, repoRoot) {
  const { file, side } = locateDeclaration(repoRoot);
  let declaration;
  try { declaration = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { declarationInvalid([`hfs.json cannot be read (${String(error?.code ?? error?.message ?? error).split('\n')[0]})`], file); }
  return resolveRepoDeclaration(manifest, declaration, { file, side });
}

// ------------------------------------------------------------------------------------------- resolver

const isEntryFile = (name) => name === 'index.ts' || name === 'index.tsx';

/**
 * The four questions for one scope: the app root (profile app, root paths) or one side (profile be or fe, paths relative to the
 * side folder). createSlotResolver composes them; nothing else calls this.
 */
function createScopeResolver(manifest, repo) {
  const profile = repo.profile;
  const edition = repo.edition ?? 'full';
  const slots = manifest.slots.filter((s) => s.profiles.includes(profile) && slotInEdition(manifest, s, edition)).map((s) => effectiveSlot(s, profile, edition));
  const byId = new Map(slots.map((s) => [s.id, s]));
  const variants = slots.flatMap(variantsOf);
  const appKind = new Map(repo.apps.map((a) => [a.name, a.kind]));

  const slotEnabled = (slot) => {
    // A provider slot is gated by its provider in every edition: litePresence may lift it to required, but it still
    // exists for this repository only while a connection declares the provider.
    if (slot.provider !== undefined) return declaredSlotEnabled(slot, repo);
    if (slot.presence !== 'opt-in') return true;
    return declaredSlotEnabled(slot, repo);
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

  /** The role of a file in its slot: the entry of `roles` whose file name (variables filled from the path, `*` a wildcard inside the name) matches the file's name. */
  function roleOf(slot, bindings, p) {
    const name = p.split('/').pop();
    for (const [role, file] of Object.entries(slot.roles ?? {})) if (globExpression(fillVars(file, bindings)).test(name)) return role;
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
    // A runtime owner is imported file by file (crossOwner of knowledge/hfs/runtime-slots.yaml): no public entry.
    if (toOwner && repo.kind !== RUNTIME_KIND) {
      const relative = to.path === toOwner.root ? '' : to.path.slice(toOwner.root.length + 1);
      const ownerSlot = byId.get(toOwner.slot);
      const entry = isEntryFile(relative) || (byId.get(to.slot).entries ?? []).includes(to.path.slice(to.root.length + 1)) || (ownerSlot.tier === 'package' && relative === 'src/index.ts') || (ownerSlot.tier === 'app' && relative === 'app.module.ts');
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
      if (slot.presence !== 'required' || !slotEnabled(slot)) continue;
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
    ruleParams: () => ruleParams(manifest, profile, edition),
    allowedImports: (tier) => manifest.tiers[profile]?.[tier]?.mayImport ?? null,
  });
}

/**
 * The four questions for one app, or for one side of it. `repo` comes from resolveRepoDeclaration / readRepoDeclaration.
 * Paths are relative to the root the declaration was resolved for (backslashes and a leading ./ are folded; a trailing / or a
 * directory path is fine): a side view (repo.side set) answers for the side folder as its root, exactly as a check of that side
 * runs; the app (profile app) answers a root path with the app-root slots and a path below be/ or fe/ with that side's view,
 * the side prefixed back onto every path and root it returns (and `side` added). Only the declared `reads` cross sides.
 */
export function createSlotResolver(manifest, repo) {
  if (repo.profile !== APP_SCOPE) return createScopeResolver(manifest, repo);
  // The root declares no connection of its own, yet a provider slot of the app profile (app.supabase*) is enabled by a
  // side's connection with that provider: the root scope reads the union of the sides' connections.
  const root = createScopeResolver(manifest, { ...repo, connections: SIDES.flatMap((side) => repo.sides[side].connections) });
  const sides = Object.fromEntries(PROFILES.map((side) => [side, createScopeResolver(manifest, repo.sides[side])]));
  const clean = (p) => posixPath(p).replace(/\/+$/, '');
  /** { side, rest } when `p` lies below a side folder, else null. */
  const split = (input) => {
    const p = clean(input);
    const slash = p.indexOf('/');
    const head = slash < 0 ? p : p.slice(0, slash);
    return PROFILES.includes(head) && slash > 0 ? { side: head, rest: p.slice(slash + 1) } : null;
  };
  const under = (side, rel) => (rel ? `${side}/${rel}` : side);
  const prefixed = (side, c) => ({
    ...c,
    path: under(side, c.path),
    side,
    ...(c.root !== undefined ? { root: under(side, c.root) } : {}),
    ...(c.nearest ? { nearest: { ...c.nearest, matchedPrefix: under(side, c.nearest.matchedPrefix), matchedDepth: c.nearest.matchedDepth + 1 } } : {}),
  });
  const classifyPath = (input) => { const at = split(input); return at ? prefixed(at.side, sides[at.side].classifyPath(at.rest)) : root.classifyPath(input); };
  const ownerOf = (input) => {
    const at = split(input);
    if (!at) return root.ownerOf(input);
    const owner = sides[at.side].ownerOf(at.rest);
    return owner ? { ...owner, root: under(at.side, owner.root), side: at.side } : null;
  };
  const allSlots = [...new Map([...root.slots(), ...PROFILES.flatMap((side) => sides[side].slots())].map((s) => [s.id, s])).values()];
  const byId = new Map(allSlots.map((s) => [s.id, s]));
  /** Whether `toPath`, of the other side, lies below a path `fromSide` declares it reads. */
  const reads = (fromSide, toPath) => repo.sides[fromSide].reads.some((read) => `${clean(toPath)}/`.startsWith(read));
  return Object.freeze({
    repo,
    sides: Object.freeze(sides),
    /** The side of a path (be, fe) or null for a root path. */
    sideOf: (input) => split(input)?.side ?? null,
    slot: (id) => byId.get(id) ?? null,
    slots: () => allSlots,
    slotEnabled: (slot) => (slot.profiles.includes(APP_SCOPE) ? root.slotEnabled(slot) : PROFILES.some((side) => slot.profiles.includes(side) && sides[side].slotEnabled(slot))),
    classifyPath,
    slotOf: (p) => { const c = classifyPath(p); return c.slot ? byId.get(c.slot) : null; },
    ownerOf,
    tierOf: (input) => { const at = split(input); return at ? sides[at.side].tierOf(at.rest) : root.tierOf(input); },
    importAllowed(fromPath, toPath) {
      const from = split(fromPath);
      const to = split(toPath);
      if (from && to && from.side !== to.side) {
        return reads(from.side, toPath) ? { allowed: true, reason: 'sideRead', fromSide: from.side, toSide: to.side } : { allowed: false, reason: 'crossSide', fromSide: from.side, toSide: to.side, reads: repo.sides[from.side].reads };
      }
      // A side file may read an app-root path (supabase/types/) only through a declared read, exactly as it reads the other side.
      if (from && !to) {
        return reads(from.side, toPath) ? { allowed: true, reason: 'sideRead', fromSide: from.side, toSide: null } : { allowed: false, reason: 'crossSide', fromSide: from.side, toSide: null, reads: repo.sides[from.side].reads };
      }
      if (from && to) return sides[from.side].importAllowed(from.rest, to.rest);
      return root.importAllowed(fromPath, toPath);
    },
    requiredFiles: (input) => { const at = split(input); return at ? sides[at.side].requiredFiles(at.rest).map((p) => under(at.side, p)) : root.requiredFiles(input); },
    requiredPaths() {
      const own = root.requiredPaths();
      const paths = [...own.paths];
      const minimums = [...own.minimums];
      for (const side of PROFILES) {
        const required = sides[side].requiredPaths();
        paths.push(...required.paths.map((entry) => ({ ...entry, path: under(side, entry.path), side })));
        minimums.push(...required.minimums.map((entry) => ({ ...entry, side })));
      }
      return { paths, minimums };
    },
    trackingOf: (p) => classifyPath(p).tracking ?? null,
    isTracked: (p) => classifyPath(p).tracking === 'tracked',
    // The root has no tier and no rule parameters of its own; each side has them (sides.<side>.ruleParams()).
    ruleParams: () => null,
    allowedImports: () => null,
  });
}

/** The rule parameters of one profile (be: infraOwners, suffixes, bannedSuffixes and the rest over the shared ruleParams.common fileLines and duplicateBlock; fe: common alone or with its overrides; runtime: ruleParams.runtime of a runtime manifest), as a frozen deep copy. Under `edition` lite the `lite` overrides of ruleParams.<profile> merge over the base (the `lite` key itself is never returned). */
export function ruleParams(manifest, profile, edition = 'full') {
  const profiles = manifestKind(manifest) === RUNTIME_KIND ? [RUNTIME_KIND] : PROFILES;
  if (!profiles.includes(profile)) fail('HFS_MANIFEST_INVALID', `ruleParams has no profile ${profile}`, { profile });
  return editionRuleParams({ ...manifest.ruleParams.common, ...manifest.ruleParams[profile] }, edition);
}

/**
 * The manifest of this runtime plus the resolver for the app or side folder at `repoRoot` (a side folder gets that side's view), or
 * for an already-parsed declaration (the app, or with `side` that side's view).
 */
export function openHfs({ root = skillRoot, repoRoot, declaration, side = null, manifest = loadSlotManifest({ root }) } = {}) {
  const repo = declaration !== undefined ? resolveRepoDeclaration(manifest, declaration, { side }) : readRepoDeclaration(manifest, repoRoot);
  return { manifest, repo, ...createSlotResolver(manifest, repo), rules: () => loadRuleCatalog({ root, manifest }) };
}

// ------------------------------------------------------------------------------------------ rule catalog

const HFS_RULES_FILE = 'knowledge/hfs/rules.yaml';
const RULE_GATES = Object.freeze(['pre-commit', 'pre-push', 'settle', 'land', 'ci', 'sonar', 'runtime']);
const ENFORCER_FAMILIES = Object.freeze(['eslint-be', 'eslint-fe', 'stylelint', 'machine', 'hfs', 'work-validate', 'sonar', 'runtime']);
const RULE_KINDS = Object.freeze(['codemod', 'lint', 'check', 'design']);
const FINDING_CODE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;
const ENFORCER_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const FILE_ENFORCERS = ['machine', 'hfs', 'work-validate', 'sonar', 'runtime'];

/** Shape and semantic problems of a parsed knowledge/hfs/rules.yaml, in the words of modules/schemas/hfs-rules.schema.yaml. */
function ruleCatalogProblems(d) {
  const bad = [];
  if (!isPlainObject(d)) return ['the rule catalog is not a map'];
  for (const key of Object.keys(d)) if (!['schema', 'version', 'gates', 'enforcerKinds', 'rules', 'retired'].includes(key)) bad.push(`unknown top-level key ${key}`);
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
    for (const key of Object.keys(r)) if (!['id', 'code', 'law', 'scope', 'kinds', 'gates', 'failureCodes', 'editions', 'enforcers'].includes(key)) bad.push(`${label} has unknown key ${key}`);
    // A retired rule leaves its id unused for good (never reused), so ids only have to increase.
    if (!/^R\d{2,3}$/.test(String(r.id))) bad.push(`${at}.id must be R<two or three digits>`);
    else if (index > 0 && typeof d.rules[index - 1]?.id === 'string' && Number(r.id.slice(1)) <= Number(d.rules[index - 1].id.slice(1))) bad.push(`${label} is out of order: ids must increase, and ${d.rules[index - 1].id} comes before it`);
    if (!FINDING_CODE.test(String(r.code))) bad.push(`${label}.code must be an UPPER_SNAKE finding code`);
    if (typeof r.law !== 'string' || !r.law.trim()) bad.push(`${label}.law is missing`);
    if (typeof r.law === 'string' && r.law.includes('\n')) bad.push(`${label}.law must be one line`);
    if (r.scope !== undefined && r.scope !== 'runtime') bad.push(`${label}.scope is absent or runtime`);
    const enumList = (key, allowed) => {
      if (!Array.isArray(r[key]) || !r[key].length) { bad.push(`${label}.${key} must be a non-empty list`); return []; }
      for (const v of r[key]) if (!allowed.includes(v)) bad.push(`${label}.${key} has ${JSON.stringify(v)}, not one of ${allowed.join(', ')}`);
      if (new Set(r[key]).size !== r[key].length) bad.push(`${label}.${key} repeats a value`);
      return r[key];
    };
    enumList('kinds', RULE_KINDS);
    bad.push(...ruleEditionProblems(r, label));
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
      for (const key of Object.keys(e)) if (!['kind', 'id', 'status', 'at', 'editions'].includes(key)) bad.push(`${eat} has unknown key ${key}`);
      bad.push(...ruleEditionProblems(e, eat));
      if (!ENFORCER_FAMILIES.includes(e.kind)) bad.push(`${eat}.kind must be one of ${ENFORCER_FAMILIES.join(', ')}`);
      if (!ENFORCER_ID.test(String(e.id))) bad.push(`${eat}.id must be kebab-case`);
      if (seen.has(`${e.kind}:${e.id}`)) bad.push(`${eat} repeats ${e.kind}:${e.id}`);
      seen.add(`${e.kind}:${e.id}`);
      if (e.status !== undefined && e.status !== 'planned') bad.push(`${eat}.status is either absent or planned`);
      if (e.at !== undefined) {
        if (typeof e.at !== 'string' || !e.at.trim() || e.at.startsWith('/') || e.at.includes('..')) bad.push(`${eat}.at must be a repository-relative path`);
        if (e.status === 'planned') bad.push(`${eat} is planned, so it has no file yet (at)`);
        if (!FILE_ENFORCERS.includes(e.kind)) bad.push(`${eat}.at belongs to a machine, hfs, work-validate, sonar or runtime enforcer only`);
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
    rules: list, retired: deepFreeze(structuredClone(doc.retired ?? [])),
    /** The rule with this id (R01..), or null. */
    rule: (id) => byId.get(id) ?? null,
    /** The rule that owns this failure code (its own or a sub-check code), or null. */
    byCode: (code) => byCode.get(code) ?? null,
    /** Whether a finding code is judged under `edition`: a code of a rule that names `editions` without it is not (a code outside the catalog always is). */
    judgedIn: (code, edition = 'full') => judgedInEdition(byCode.get(code), edition),
    enforcerJudgedIn: (kind, id, edition = 'full') => enforcerJudgedInEdition(list, kind, id, edition),
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
