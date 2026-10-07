// declaration-shape.mjs - the dependency-free hfs.json shape validation used by the HFS slot loader. Semantic checks
// against a loaded manifest remain in slots.mjs; this module mirrors modules/schemas/hfs-repo.schema.yaml only.
import { isPlainObject } from '../../engine/plain-object.mjs';
import { APP_KIND, connectionShapeProblems, NAME, RUNTIME_KIND, SLOT_ID } from './manifest-shape.mjs';
import { kindShapeProblems, patternShapeProblems } from './declaration-slots.mjs';
import { byCodeUnit } from '../lib/list.mjs';

/** Shape problems of the optional hfs.json `supabase` block whose auth posture DB_CONFIG_POLICY checks. */
const isSupabaseStringList = (value) => Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.trim());

function supabaseValueProblems(block) {
  const bad = [];
  if (block.enableSignup !== undefined && typeof block.enableSignup !== 'boolean') bad.push('supabase.enableSignup must be true or false');
  if (block.jwtExpiry !== undefined && !(Number.isInteger(block.jwtExpiry) && block.jwtExpiry > 0 && block.jwtExpiry <= 3600)) bad.push('supabase.jwtExpiry must be an integer of seconds, 3600 at most');
  if (block.siteUrl !== undefined && (typeof block.siteUrl !== 'string' || !block.siteUrl.trim())) bad.push('supabase.siteUrl must be a URL string');
  for (const key of ['redirectUrls', 'forceRls']) if (block[key] !== undefined && !isSupabaseStringList(block[key])) bad.push(`supabase.${key} must be a list of strings`);
  return bad;
}

function supabaseBlockProblems(block) {
  if (block === undefined) return [];
  if (!isPlainObject(block)) return ['supabase must be an object'];
  const bad = [];
  for (const key of Object.keys(block)) if (!['enableSignup', 'jwtExpiry', 'siteUrl', 'redirectUrls', 'forceRls'].includes(key)) bad.push(`supabase has unknown key ${key}`);
  bad.push(...supabaseValueProblems(block));
  return bad;
}

function appShapeProblems(apps, at, side, names) {
  const bad = [];
  if (!Array.isArray(apps) || !apps.length) {
    bad.push(`${at}.apps must list every ${side}/apps/<name> with its kind`);
    return bad;
  }
  apps.forEach((app, index) => {
    if (!isPlainObject(app) || !NAME.test(String(app.name)) || !NAME.test(String(app.kind)) || Object.keys(app).some((key) => key !== 'name' && key !== 'kind')) bad.push(`${at}.apps[${index}] must be {name, kind}`);
    else if (names.has(app.name)) bad.push(`app ${app.name} is declared twice (${names.get(app.name)} and ${side})`);
    else names.set(app.name, side);
  });
  return bad;
}

function connectionProblems(side, value) {
  const bad = [];
  if (side !== 'be') {
    bad.push('connections belong to the be side');
    return bad;
  }
  const list = Array.isArray(value.connections) ? value.connections : null;
  const shape = connectionShapeProblems(list, value.apps);
  if (shape.length) {
    bad.push(...shape);
    return bad;
  }
  if (new Set(list.map((connection) => connection.name)).size !== list.length) bad.push('connections names must be unique');
  for (const a of list) for (const b of list) if (a !== b && `${b.envPrefix}_`.startsWith(`${a.envPrefix}_`)) bad.push(`connections ${a.name} and ${b.name} share env keys (${a.envPrefix}_ covers ${b.envPrefix}_)`);
  return bad;
}

/** Whether a declared list is present but not a list of distinct entries that all satisfy `valid`. */
const isBadUniqueList = (list, valid) => list !== undefined && (!Array.isArray(list) || !list.every(valid) || new Set(list).size !== list.length);

function declarationSideProblems(side, value, names) {
  const bad = [];
  const at = `sides.${side}`;
  if (!isPlainObject(value)) return [`${at} must be an object`];
  for (const key of Object.keys(value)) if (!['apps', 'optionalSlots', 'patterns', 'kinds', 'connections', 'reads'].includes(key)) bad.push(`${at} has unknown key ${key}`);
  bad.push(...appShapeProblems(value.apps, at, side, names));
  if (isBadUniqueList(value.optionalSlots, (slot) => SLOT_ID.test(String(slot)))) bad.push(`${at}.optionalSlots must be a unique list of slot ids`);
  bad.push(...patternShapeProblems(value, at, NAME), ...kindShapeProblems(value, at, NAME));
  if (isBadUniqueList(value.reads, (read) => typeof read === 'string' && read.length > 0)) bad.push(`${at}.reads must be a unique list of paths`);
  if (value.connections !== undefined) bad.push(...connectionProblems(side, value));
  return bad;
}

const DECLARATION_KEYS = new Set(['hfs', 'kind', 'project', 'edition', 'supabase', 'sides', 'browser']);
const RUNTIME_DECLARATION_KEYS = new Set(['hfs', 'kind', 'project']);

function productDeclarationProblems(declaration, profiles) {
  const bad = [];
  for (const key of Object.keys(declaration)) if (!DECLARATION_KEYS.has(key)) bad.push(`unknown key ${key}`);
  bad.push(...supabaseBlockProblems(declaration.supabase));
  if (declaration.browser !== undefined && declaration.browser !== true) bad.push('browser is `true` when the app has a browser journey (slot app.browser), and is left out otherwise');
  if (declaration.kind !== APP_KIND) bad.push(`kind must be ${APP_KIND} (a product is one app repository with a be and an fe side) or ${RUNTIME_KIND} (the StarCi runtime repository)`);
  if (!isPlainObject(declaration.sides) || Object.keys(declaration.sides).sort(byCodeUnit).join() !== profiles.join()) { bad.push('sides must declare exactly be and fe'); return bad; }
  const names = new Map();
  for (const side of profiles) bad.push(...declarationSideProblems(side, declaration.sides[side], names));
  return bad;
}

/** Shape problems of a parsed hfs.json, in the words of modules/schemas/hfs-repo.schema.yaml. */
export function declarationShapeProblems(declaration, profiles) {
  const bad = [];
  if (!isPlainObject(declaration)) return ['hfs.json is not an object'];
  if (!(Number.isInteger(declaration.hfs) && declaration.hfs >= 1)) bad.push('hfs must be the pinned manifest major (an integer, 1 or more)');
  if (!NAME.test(String(declaration.project))) bad.push('project must be a project name');
  if (declaration.kind === RUNTIME_KIND) {
    for (const key of Object.keys(declaration)) if (!RUNTIME_DECLARATION_KEYS.has(key)) bad.push(`unknown key ${key} (a runtime declaration is {hfs, kind, project})`);
    return bad;
  }
  bad.push(...productDeclarationProblems(declaration, profiles));
  return bad;
}
