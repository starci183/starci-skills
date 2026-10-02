// manifest-shape.mjs - the shape rules of an HFS slot manifest that both manifest kinds share, and the whole shape of a
// manifest of kind runtime (knowledge/hfs/runtime-slots.yaml): the slot fields, the tier map, ruleParams.runtime and the
// `pending` allowlist. scripts/hfs/slots.mjs (loadSlotManifest) is the only reader; it adds the app kind's own rules
// (sides, app kinds) and refuses a manifest whole on any problem (HFS_MANIFEST_INVALID). Pure: every function takes a
// parsed manifest or slot and returns a list of problems in the words of modules/schemas/hfs-slots.schema.yaml.
import { isPlainObject } from '../../engine/plain-object.mjs';
import { stringList } from '../lib/list.mjs';

export const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
export const NAME = /^[a-z][a-z0-9-]*$/;
export const ENV_PREFIX = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;
/** How a bounded context (a connection) is isolated: its own logical database, or its own schema of a shared one. */
const CONTEXT_ISOLATIONS = Object.freeze(["database", "schema"]);
/** The app kinds that may own a context: the services, never the migrate or cli apps that only run migrations. */
const CONTEXT_OWNER_KINDS = Object.freeze(["api", "worker"]);
/** The database engines a connection may run on: a self-described Postgres, or the Postgres of a Supabase project. */
const CONNECTION_PROVIDERS = Object.freeze(["postgres", "supabase"]);
/** The editions an app repository may declare in hfs.json (`full` when absent): the filter slots.mjs applies. */
export const EDITIONS = Object.freeze(["full", "lite"]);
/** What decides where schema changes live (ruleParams.<side>.schemaAuthority): TypeORM migrations under persistence/, or the Supabase migration tree. */
export const SCHEMA_AUTHORITIES = Object.freeze(["typeorm", "supabase"]);
/**
 * The shape problems of the `connections` of one side: a list of {name, envPrefix, owner, isolation}, the owner an api or worker app
 * of the same side (a connection is a bounded context and one service owns it), isolation `database` or `schema`.
 *
 * @param {unknown} list - The declared connections (null when it is not an array).
 * @param {unknown} apps - The declared apps of the same side.
 * @returns {string[]} The problems, none when the shape is right.
 */
export function connectionShapeProblems(list, apps) {
  const keys = (c) => isPlainObject(c) && NAME.test(String(c.name)) && ENV_PREFIX.test(String(c.envPrefix)) && NAME.test(String(c.owner)) && CONTEXT_ISOLATIONS.includes(c.isolation)
    && (c.provider === undefined || CONNECTION_PROVIDERS.includes(c.provider))
    && Object.keys(c).every((k) => ['name', 'envPrefix', 'owner', 'isolation', 'provider'].includes(k)) && ['name', 'envPrefix', 'owner', 'isolation'].every((k) => k in c);
  if (!list || !list.every(keys)) return [`connections must be a list of {name: kebab-case context name, envPrefix: UPPER_SNAKE prefix of its env keys, owner: the service app that owns the context, isolation: ${CONTEXT_ISOLATIONS.join(' | ')}, provider?: ${CONNECTION_PROVIDERS.join(' | ')}}`];
  const owns = (c) => Array.isArray(apps) && apps.some((app) => isPlainObject(app) && app.name === c.owner && CONTEXT_OWNER_KINDS.includes(app.kind));
  return list.filter((c) => !owns(c)).map((c) => `connections ${c.name} is owned by ${c.owner}, which is not a ${CONTEXT_OWNER_KINDS.join(' or ')} app declared in the same side`);
}
export const SLOT_ID = /^(app|repo|be|fe)\.[a-z0-9-]+(\.[a-z0-9-]+)*$/;
const RUNTIME_SLOT_ID = /^runtime\.[a-z0-9-]+(\.[a-z0-9-]+)*$/;
export const PRESENCE = ['required', 'optional', 'opt-in', 'forbidden'];
export const TRACKED = ['tracked', 'ignored', 'external'];
/** A runtime manifest adds `generated`: tracked, written only by the slot's generatedBy, judged by drift (RT_GENERATED_DRIFT). */
const RUNTIME_TRACKED = [...TRACKED, 'generated'];
export const TESTS = ['unit-beside', 'e2e', 'none'];
/** The coverage mode of a tracked slot of the be profile (scripts/hfs/coverage-scope.mjs derives the three coverage consumers from it). */
export const COVERAGE = ['required', 'none'];
export const APP_KIND = 'app';

/**
 * The unit-tested roles of a back end whose spec is required (ruleParams.be.unitRoles of the slot manifest): [{ role, spec, slot?, exempt? }].
 * THE one list: every check that asks "is this file unit-tested, and where is its spec" asks it here. What the unit run MEASURES is
 * logicRoles over the coverage-required slots (coverage-scope.mjs), not this list.
 */
export const unitRolesOf = (manifest) => manifest.ruleParams.be.unitRoles;

/** The roles that carry logic (ruleParams.be.logicRoles): measured at 100 per file inside a coverage-required slot. */
export const logicRolesOf = (manifest) => manifest.ruleParams.be.logicRoles;

/** The roles a feature-tier file is judged thin by (ruleParams.be.thinRoles, R203 BE_FEATURE_THIN). */
export const thinRolesOf = (manifest) => manifest.ruleParams.be.thinRoles;

/** Shape problems of ruleParams.be.unitRoles: unique roles of the suffix vocabulary, each spec `<role>.spec`. */
export function unitRolesProblems(be) {
  const roles = be.unitRoles;
  const roleOk = (r) => r !== null && typeof r === 'object' && !Array.isArray(r) && Object.keys(r).every((k) => ['role', 'spec', 'slot', 'exempt'].includes(k)) && NAME.test(String(r.role)) && String(r.spec) === `${r.role}.spec` && (r.slot === undefined || /^be.[a-z0-9.-]+$/.test(String(r.slot))) && (r.exempt === undefined || (Array.isArray(r.exempt) && r.exempt.every((c) => /^[A-Z][A-Z0-9_]+$/.test(String(c)))));
  if (!Array.isArray(roles) || !roles.length || !roles.every(roleOk) || new Set(roles.map((r) => r.role)).size !== roles.length) return ['ruleParams.be.unitRoles must be a non-empty list of unique {role, spec: <role>.spec, slot?, exempt?: [rule codes]}'];
  if (Array.isArray(be.suffixes) && roles.some((r) => !be.suffixes.includes(r.role))) return ['ruleParams.be.unitRoles names a role that is not in ruleParams.be.suffixes'];
  return [];
}

/** Shape problems of ruleParams.be.logicRoles and thinRoles: each a non-empty list of unique roles of the suffix vocabulary; every unit role is a logic role. */
export function roleListProblems(be) {
  const bad = [];
  for (const key of ['logicRoles', 'thinRoles']) {
    const list = be[key];
    if (!strList(list) || !list.length || new Set(list).size !== list.length || !list.every((role) => NAME.test(role))) bad.push(`ruleParams.be.${key} must be a non-empty list of unique kebab-case roles`);
    else if (Array.isArray(be.suffixes) && list.some((role) => !be.suffixes.includes(role))) bad.push(`ruleParams.be.${key} names a role that is not in ruleParams.be.suffixes`);
  }
  if (strList(be.logicRoles) && Array.isArray(be.unitRoles) && be.unitRoles.some((r) => r?.slot === undefined && !be.logicRoles.includes(r?.role))) bad.push('every ruleParams.be.unitRoles role that is not tied to a slot is a logic role (ruleParams.be.logicRoles)');
  return bad;
}
/** The kind of a manifest and of a declaration that describes the StarCi runtime repository; also its one profile. */
export const RUNTIME_KIND = 'runtime';
export const MANIFEST_KINDS = [APP_KIND, RUNTIME_KIND];
/** The kind of a parsed manifest: `kind`, or app when absent (knowledge/hfs/slots.yaml carries none). */
export const manifestKind = (m) => (isPlainObject(m) && m.kind !== undefined ? m.kind : APP_KIND);
const strList = (v) => stringList(v);

const APP_SLOT_KEYS = ['id', 'profiles', 'path', 'presence', 'tracked', 'tier', 'tests', 'owner', 'appKind', 'minInstances', 'requiredWhen', 'requiredInstances', 'requires', 'pattern', 'trigger', 'allows', 'forbids', 'layers', 'kinds', 'roles', 'composedBy', 'budget', 'managedBy', 'liteManagedBy', 'rules', 'goesTo', 'why', 'since', 'retiredIn', 'successor', 'perConnection', 'editions', 'litePresence', 'lite', 'provider', 'coverage', 'entries', 'outcomeHome', 'anonymousActions'];
/** The fields a slot's `lite` overlay may hold: the same keys it would carry in the slot body, resolved under edition lite. */
const LITE_OVERLAY_KEYS = ['path', 'requires', 'allows', 'forbids', 'minInstances', 'requiredInstances'];
/** A runtime slot has no app kind, side composition, layer or managed template; it may name the generator of a generated copy. */
const RUNTIME_SLOT_KEYS = ['id', 'profiles', 'path', 'presence', 'tracked', 'tier', 'tests', 'owner', 'minInstances', 'requires', 'allows', 'forbids', 'budget', 'rules', 'goesTo', 'why', 'since', 'retiredIn', 'successor', 'generatedBy'];

/** Shape problems of one slot of a manifest of `kind` (app or runtime). */
export function slotProblems(slot, index, kind, { appScope = 'app', scopes = [] } = {}) {
  const bad = [];
  const runtime = kind === RUNTIME_KIND;
  const slotKeys = new Set(runtime ? RUNTIME_SLOT_KEYS : APP_SLOT_KEYS);
  const tracked = runtime ? RUNTIME_TRACKED : TRACKED;
  const at = isPlainObject(slot) && typeof slot.id === 'string' ? `slot ${slot.id}` : `slots[${index}]`;
  if (!isPlainObject(slot)) return [`${at} is not a map`];
  for (const key of Object.keys(slot)) if (!slotKeys.has(key)) bad.push(`${at}: unknown field ${key}`);
  if (runtime) {
    if (!RUNTIME_SLOT_ID.test(String(slot.id))) bad.push(`${at}: id must look like runtime.<name>`);
    if (JSON.stringify(slot.profiles) !== JSON.stringify([RUNTIME_KIND])) bad.push(`${at}: profiles must be [runtime]`);
    if (slot.tracked === 'generated' && (typeof slot.generatedBy !== 'string' || !slot.generatedBy || slot.generatedBy.startsWith('/') || slot.generatedBy.includes('..'))) bad.push(`${at}: a generated slot names its generator (generatedBy, a repository-relative path)`);
    if (slot.generatedBy !== undefined && slot.tracked !== 'generated') bad.push(`${at}: generatedBy belongs to a generated slot`);
  } else {
    if (!SLOT_ID.test(String(slot.id))) bad.push(`${at}: id must look like be.transport.http`);
    if (!Array.isArray(slot.profiles) || !slot.profiles.length || !slot.profiles.every((p) => scopes.includes(p)) || new Set(slot.profiles).size !== slot.profiles.length || (slot.profiles.includes(appScope) && slot.profiles.length !== 1)) bad.push(`${at}: profiles must be [app] or a unique non-empty subset of be, fe`);
    else if ((slot.profiles[0] === appScope) !== String(slot.id).startsWith(`${appScope}.`)) bad.push(`${at}: an app-root slot has profiles [app] and an id app.<name>, and only it`);
  }
  if (typeof slot.path !== 'string' || !slot.path) bad.push(`${at}: path is required`);
  if (!PRESENCE.includes(slot.presence)) bad.push(`${at}: presence must be one of ${PRESENCE.join(', ')}`);
  if (!tracked.includes(slot.tracked)) bad.push(`${at}: tracked must be one of ${tracked.join(', ')}`);
  if (!NAME.test(String(slot.tier))) bad.push(`${at}: tier must be a tier name, none or inherit`);
  if (!TESTS.includes(slot.tests)) bad.push(`${at}: tests must be one of ${TESTS.join(', ')}`);
  if (slot.owner !== undefined && typeof slot.owner !== 'boolean') bad.push(`${at}: owner must be a boolean`);
  if (!runtime) {
    const measured = Array.isArray(slot.profiles) && slot.profiles.includes('be') && slot.tracked === 'tracked';
    if (measured && !COVERAGE.includes(slot.coverage)) bad.push(`${at}: coverage must be one of ${COVERAGE.join(', ')} (every tracked slot of the be profile declares it)`);
    if (!measured && slot.coverage !== undefined) bad.push(`${at}: coverage belongs to a tracked slot of the be profile only`);
  }
  if (slot.appKind !== undefined && !NAME.test(String(slot.appKind))) bad.push(`${at}: appKind must be a name`);
  if (slot.trigger !== undefined && !NAME.test(String(slot.trigger))) bad.push(`${at}: trigger must be a trigger kind name`);
  if (slot.pattern !== undefined && !NAME.test(String(slot.pattern))) bad.push(`${at}: pattern must be a pattern name`);
  if (slot.minInstances !== undefined && !(Number.isInteger(slot.minInstances) && slot.minInstances >= 1)) bad.push(`${at}: minInstances must be a positive integer`);
  if (slot.requiredWhen !== undefined && slot.requiredWhen !== 'connections') bad.push(`${at}: requiredWhen may only be connections`);
  if (slot.pattern !== undefined && !/^[a-z][a-z0-9-]*$/.test(String(slot.pattern))) bad.push(`${at}: pattern must be a kebab-case pattern name`);
  if (slot.requiredInstances !== undefined && !(isPlainObject(slot.requiredInstances) && Object.values(slot.requiredInstances).every((v) => strList(v) && v.length))) bad.push(`${at}: requiredInstances must map a variable to a non-empty list of names`);
  for (const key of ['requires', 'allows', 'forbids', 'layers', 'kinds']) if (slot[key] !== undefined && !strList(slot[key])) bad.push(`${at}: ${key} must be a list of strings`);
  if (slot.kinds !== undefined && strList(slot.kinds) && (!slot.kinds.length || new Set(slot.kinds).size !== slot.kinds.length || slot.kinds.some((k) => !NAME.test(k) || (slot.layers ?? []).includes(k)))) bad.push(`${at}: kinds must be a non-empty list of unique folder names that are not layers`);
  if (slot.roles !== undefined && !(isPlainObject(slot.roles) && Object.keys(slot.roles).length && Object.entries(slot.roles).every(([role, file]) => NAME.test(role) && typeof file === 'string' && file && !file.includes('/')))) bad.push(`${at}: roles must map a role name to a file name`);
  if (slot.composedBy !== undefined && !(strList(slot.composedBy) && slot.composedBy.length && new Set(slot.composedBy).size === slot.composedBy.length)) bad.push(`${at}: composedBy must be a non-empty list of unique app kinds`);
  if (slot.budget !== undefined && !(isPlainObject(slot.budget) && Object.keys(slot.budget).length && Object.values(slot.budget).every((v) => Number.isInteger(v) && v >= 1))) bad.push(`${at}: budget must map names to positive integers`);
  if (slot.managedBy !== undefined && !NAME.test(String(slot.managedBy))) bad.push(`${at}: managedBy must be a template id`);
  if (slot.liteManagedBy !== undefined && !NAME.test(String(slot.liteManagedBy))) bad.push(`${at}: liteManagedBy must be a template id`);
  if (!runtime) {
    if (slot.editions !== undefined && !(Array.isArray(slot.editions) && slot.editions.length && slot.editions.every((e) => EDITIONS.includes(e)) && new Set(slot.editions).size === slot.editions.length)) bad.push(`${at}: editions must be a non-empty subset of ${EDITIONS.join(', ')}`);
    if (slot.litePresence !== undefined && !(PRESENCE.includes(slot.litePresence) || (isPlainObject(slot.litePresence) && Object.keys(slot.litePresence).length && Object.entries(slot.litePresence).every(([side, value]) => ['be', 'fe'].includes(side) && PRESENCE.includes(value))))) bad.push(`${at}: litePresence must be a presence value or map sides to presence values`);
    if (slot.provider !== undefined) {
      if (!CONNECTION_PROVIDERS.includes(slot.provider)) bad.push(`${at}: provider must be one of ${CONNECTION_PROVIDERS.join(' | ')}`);
      else if (slot.presence !== 'opt-in' || slot.appKind !== undefined) bad.push(`${at}: provider belongs to an opt-in slot that is not an app kind (a connection with that provider enables it)`);
    }
    if (slot.lite !== undefined) {
      const ok = isPlainObject(slot.lite) && Object.keys(slot.lite).length && Object.keys(slot.lite).every((key) => LITE_OVERLAY_KEYS.includes(key))
        && (slot.lite.path === undefined || (typeof slot.lite.path === 'string' && slot.lite.path))
        && ['requires', 'allows', 'forbids'].every((key) => slot.lite[key] === undefined || strList(slot.lite[key]))
        && (slot.lite.minInstances === undefined || (Number.isInteger(slot.lite.minInstances) && slot.lite.minInstances >= 1))
        && (slot.lite.requiredInstances === undefined || (isPlainObject(slot.lite.requiredInstances) && Object.values(slot.lite.requiredInstances).every((v) => strList(v) && v.length)));
      if (!ok) bad.push(`${at}: lite may hold only ${LITE_OVERLAY_KEYS.join(', ')}, each shaped as in the slot body`);
    }
  }
  if (slot.entries !== undefined) {
    const listed = strList(slot.entries) && slot.entries.length > 0 && new Set(slot.entries).size === slot.entries.length && slot.entries.every(relPath);
    if (!listed) bad.push(`${at}: entries must be a non-empty list of unique relative file paths`);
    else if (typeof slot.path !== 'string' || !slot.path.endsWith('/') || slot.owner === true) bad.push(`${at}: entries belong to a directory slot that is not an owner (they name extra public entries of the owner that holds it)`);
    else if (Array.isArray(slot.allows) && slot.entries.some((entry) => !slot.allows.includes(entry))) bad.push(`${at}: every entry must be one of the names the slot allows`);
  }
  if (slot.anonymousActions !== undefined && !(strList(slot.anonymousActions) && slot.anonymousActions.length > 0 && new Set(slot.anonymousActions).size === slot.anonymousActions.length && slot.anonymousActions.every(relPath) && typeof slot.path === 'string' && slot.path.endsWith('/'))) bad.push(`${at}: anonymousActions must be a non-empty list of unique relative file paths of a directory slot`);
  if (slot.outcomeHome !== undefined && !(slot.outcomeHome === true && typeof slot.path === 'string' && slot.path && !slot.path.endsWith('/'))) bad.push(`${at}: outcomeHome is true and belongs to a file slot (the one file that declares the repository's Outcome union)`);
  if (slot.rules !== undefined && !(Array.isArray(slot.rules) && slot.rules.every((r) => /^[A-Z][A-Z0-9_]*\*?$/.test(String(r))) && new Set(slot.rules).size === slot.rules.length)) bad.push(`${at}: rules must be unique rule ids`);
  if (slot.perConnection !== undefined && !(slot.id === 'be.persistence' && strList(slot.perConnection) && slot.perConnection.length && new Set(slot.perConnection).size === slot.perConnection.length && slot.perConnection.every((name) => NAME.test(name)))) bad.push(`${at}: perConnection is a unique list of capability names, only on be.persistence (the platform capabilities whose tables exist on every connection that uses them)`);
  if (slot.since !== undefined && !SEMVER.test(String(slot.since))) bad.push(`${at}: since must be a version`);
  if (slot.retiredIn !== undefined && !(Number.isInteger(slot.retiredIn) && slot.retiredIn >= 2)) bad.push(`${at}: retiredIn must be a major`);
  if (slot.retiredIn !== undefined && typeof slot.successor !== 'string') bad.push(`${at}: a retired slot names its successor`);
  if (slot.tracked === 'external' && (typeof slot.goesTo !== 'string' || slot.presence !== 'forbidden')) bad.push(`${at}: an external slot is forbidden and says where it goes (goesTo)`);
  if (slot.presence === 'forbidden' && slot.tracked !== 'external') bad.push(`${at}: a forbidden slot is external`);
  return bad;
}

/** The owners of an external call in a runtime manifest: an api system folder (`api/<system>`, `api/*` any system) or the DB tier. */
const INFRA_OWNER = /^(?:api\/(?:\*|[a-z][a-z0-9-]*)|engine\/db)$/;
const RUNTIME_PARAM_KEYS = ['fileLines', 'sourceRoots', 'infraOwners', 'baseWriteMembers', 'baseEnvSeams', 'apiContracts', 'sourceName', 'oneOffNames', 'sharedBasenames', 'generated', 'pinned', 'selfChecks'];
const PENDING_KEYS = ['path', 'rule', 'lane', 'since', 'reason'];
/** The chunk of the runtime migration that deletes a pending entry (C1..C8, a split chunk C2a/C2b). */
const PENDING_LANE = /^C[1-8][ab]?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const relPath = (v) => typeof v === 'string' && v.length > 0 && !v.startsWith('/') && !v.includes('..') && !v.includes('\\');

/** Shape problems of a parsed manifest of kind runtime (knowledge/hfs/runtime-slots.yaml), in the words of modules/schemas/hfs-slots.schema.yaml. */
export function runtimeShapeProblems(m) {
  const bad = [];
  const allowed = new Set(['schema', 'kind', 'version', 'versioning', 'presenceValues', 'trackedValues', 'testValues', 'profiles', 'tiers', 'ruleParams', 'crossOwner', 'crossSystem', 'slots', 'pending', 'consumers']);
  for (const key of Object.keys(m)) if (!allowed.has(key)) bad.push(`unknown top-level key ${key}`);
  if (!/^starci\/runtime-slots@\d+$/.test(String(m.schema))) bad.push('schema must be starci/runtime-slots@<major>');
  if (!SEMVER.test(String(m.version))) bad.push('version must be MAJOR.MINOR.PATCH');
  if (!isPlainObject(m.versioning) || !['patch', 'minor', 'major', 'retire', 'pins'].every((k) => typeof m.versioning[k] === 'string')) bad.push('versioning needs patch, minor, major, retire and pins text');
  if (JSON.stringify(m.presenceValues) !== JSON.stringify(PRESENCE)) bad.push(`presenceValues must be ${PRESENCE.join(', ')}`);
  if (JSON.stringify(m.trackedValues) !== JSON.stringify(RUNTIME_TRACKED)) bad.push(`trackedValues must be ${RUNTIME_TRACKED.join(', ')}`);
  if (JSON.stringify(m.testValues) !== JSON.stringify(TESTS)) bad.push(`testValues must be ${TESTS.join(', ')}`);
  if (JSON.stringify(m.profiles) !== JSON.stringify([RUNTIME_KIND])) bad.push('profiles must be [runtime]');
  for (const key of ['crossOwner', 'crossSystem']) if (m[key] !== undefined && typeof m[key] !== 'string') bad.push(`${key} must be text`);
  if (!isPlainObject(m.tiers) || Object.keys(m.tiers).join() !== RUNTIME_KIND) bad.push('tiers must be a map with exactly runtime');
  else bad.push(...tierMapProblems(RUNTIME_KIND, m.tiers.runtime));
  const rp = m.ruleParams;
  if (!isPlainObject(rp) || Object.keys(rp).join() !== RUNTIME_KIND || !isPlainObject(rp.runtime)) bad.push('ruleParams must be a map with exactly runtime');
  else bad.push(...runtimeParamProblems(rp.runtime));
  if (!Array.isArray(m.slots) || !m.slots.length) bad.push('slots must be a non-empty list');
  else m.slots.forEach((slot, index) => bad.push(...slotProblems(slot, index, RUNTIME_KIND)));
  if (m.pending !== undefined) {
    if (!Array.isArray(m.pending)) bad.push('pending must be a list');
    else m.pending.forEach((entry, index) => {
      const at = `pending[${index}]`;
      if (!isPlainObject(entry)) { bad.push(`${at} is not a map`); return; }
      for (const key of Object.keys(entry)) if (!PENDING_KEYS.includes(key)) bad.push(`${at}: unknown field ${key}`);
      if (!relPath(entry.path)) bad.push(`${at}: path must be a repository-relative glob`);
      if (!/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(String(entry.rule))) bad.push(`${at}: rule must be a finding code`);
      if (!PENDING_LANE.test(String(entry.lane))) bad.push(`${at}: lane must be the chunk that removes it (C1..C8, C2a, C2b)`);
      if (!DATE.test(String(entry.since))) bad.push(`${at}: since must be a date YYYY-MM-DD`);
      if (typeof entry.reason !== 'string' || !entry.reason.trim()) bad.push(`${at}: reason is required`);
    });
  }
  if (m.consumers !== undefined && !strList(m.consumers)) bad.push('consumers must be a list of paths');
  return bad;
}

/** Shape problems of ruleParams.runtime. */
function runtimeParamProblems(rp) {
  const bad = [];
  for (const key of Object.keys(rp)) if (!RUNTIME_PARAM_KEYS.includes(key)) bad.push(`ruleParams.runtime.${key} is not a runtime parameter`);
  for (const key of RUNTIME_PARAM_KEYS) if (!(key in rp)) bad.push(`ruleParams.runtime.${key} is missing`);
  const fl = rp.fileLines;
  if (!(isPlainObject(fl) && Number.isInteger(fl.soft) && fl.soft >= 1 && typeof fl.hardGrowth === 'boolean' && Object.keys(fl).length === 2)) bad.push('ruleParams.runtime.fileLines must be {soft, hardGrowth}');
  const owners = rp.infraOwners;
  const ownerMap = (v) => isPlainObject(v) && Object.entries(v).every(([key, list]) => key && Array.isArray(list) && list.every((o) => INFRA_OWNER.test(String(o))) && new Set(list).size === list.length);
  if (!isPlainObject(owners) || Object.keys(owners).sort().join() !== 'globals,modules,programs' || !['globals', 'modules', 'programs'].every((k) => ownerMap(owners[k]))) bad.push('ruleParams.runtime.infraOwners must be {modules, globals, programs}, each mapping a name to unique owners api/<system>, api/* or engine/db ([] means nowhere)');
  for (const key of ['sourceRoots', 'baseWriteMembers', 'oneOffNames', 'sharedBasenames']) if (!(strList(rp[key]) && rp[key].length && new Set(rp[key]).size === rp[key].length)) bad.push(`ruleParams.runtime.${key} must be a non-empty list of unique strings`);
  if (!(Array.isArray(rp.baseEnvSeams) && rp.baseEnvSeams.every(relPath))) bad.push('ruleParams.runtime.baseEnvSeams must be a list of repository-relative paths');
  if (!(isPlainObject(rp.apiContracts) && Object.entries(rp.apiContracts).every(([system, file]) => NAME.test(system) && relPath(file)))) bad.push('ruleParams.runtime.apiContracts must map an api system to its calls contract path');
  let sourceNameOk = typeof rp.sourceName === 'string';
  try { if (sourceNameOk) new RegExp(rp.sourceName); } catch { sourceNameOk = false; }
  if (!sourceNameOk) bad.push('ruleParams.runtime.sourceName must be a regular expression');
  if (!(Array.isArray(rp.generated) && rp.generated.length && rp.generated.every((g) => isPlainObject(g) && relPath(g.root) && relPath(g.generatedBy) && Object.keys(g).length === 2))) bad.push('ruleParams.runtime.generated must be a non-empty list of {root, generatedBy}');
  if (!(Array.isArray(rp.pinned) && rp.pinned.length && rp.pinned.every((p) => isPlainObject(p) && relPath(p.path) && typeof p.why === 'string' && p.why && Object.keys(p).length === 2))) bad.push('ruleParams.runtime.pinned must be a non-empty list of {path, why}');
  if (!(Array.isArray(rp.selfChecks) && rp.selfChecks.length && rp.selfChecks.every((c) => isPlainObject(c) && NAME.test(String(c.id)) && relPath(c.run) && (c.args === undefined || strList(c.args)) && Object.keys(c).every((k) => ['id', 'run', 'args'].includes(k))))) bad.push('ruleParams.runtime.selfChecks must be a non-empty list of {id, run, args?}');
  return bad;
}

/** Shape problems of the tier map of one profile. */
export function tierMapProblems(profile, tiers) {
  const bad = [];
  if (!isPlainObject(tiers) || !Object.keys(tiers).length) return [`tiers.${profile} must be a non-empty map`];
  for (const [tier, def] of Object.entries(tiers)) {
    if (!NAME.test(tier)) bad.push(`tiers.${profile}.${tier} is not a tier name`);
    if (!isPlainObject(def) || !Array.isArray(def.mayImport) || !def.mayImport.every((t) => NAME.test(String(t)))) bad.push(`tiers.${profile}.${tier}.mayImport must be a list of tier names`);
    for (const key of Object.keys(def ?? {})) if (!['mayImport', 'acyclic', 'lowerLayerOnly'].includes(key)) bad.push(`tiers.${profile}.${tier}.${key} is not a tier field`);
  }
  return bad;
}

/** The semantic rules of a runtime manifest beyond the slot rules both kinds share: tier names, the schema major, unique pending entries. */
export function runtimeSemanticProblems(m) {
  const bad = [];
  const tiers = m.tiers.runtime;
  for (const [tier, def] of Object.entries(tiers)) {
    for (const target of def.mayImport) if (!(target in tiers)) bad.push(`tiers.runtime.${tier}.mayImport names ${target}, which is not a runtime tier`);
  }
  const seen = new Set();
  for (const entry of m.pending ?? []) {
    const key = `${entry.path}\0${entry.rule}`;
    if (seen.has(key)) bad.push(`pending names ${entry.path} for ${entry.rule} twice`);
    seen.add(key);
  }
  const major = Number(m.version.split('.')[0]);
  if (String(m.schema) !== `starci/runtime-slots@${major}`) bad.push(`schema ${m.schema} does not carry the major of version ${m.version}`);
  return bad;
}
