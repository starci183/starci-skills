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
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYamlCached } from '../lib/yaml-cached.mjs';
import { braceVariants } from '../lib/glob.mjs';
import { APP_KIND, RUNTIME_KIND, manifestKind } from './manifest-shape.mjs';
import { APP_SCOPE, manifestShapeProblems, PROFILES } from './slot-manifest-shape.mjs';
import { manifestSemanticProblems } from './slot-semantic-problems.mjs';
import { classifyIn, ownerIn, slotEnabled, tierIn } from './slot-classify.mjs';
import { compileVariant, varsOf, variantsOf } from './slot-match.mjs';
import { importAllowedIn } from './slot-imports.mjs';
import { requiredFilesIn, requiredPathsIn } from './slot-required.mjs';
import { appResolver } from './slot-app-view.mjs';
import { sideProblems } from './slot-side-problems.mjs';
import { declarationShapeProblems } from './declaration-shape.mjs';
import { declarationEdition, editionRuleParams, effectiveSlot, slotInEdition } from './edition-slots.mjs';
import { fail } from './slot-errors.mjs';
import { loadRuleCatalog } from './rule-catalog.mjs';
export { litePresenceOf, slotInEdition } from './edition-slots.mjs';
export { HfsSlotsError } from './slot-errors.mjs';
export { loadRuleCatalog };
export { rules } from './rule-catalog.mjs';
export { APP_SCOPE };
export const HFS_MANIFEST_FILE = 'knowledge/hfs/slots.yaml';
/** The manifest of kind runtime: the standard tree of the StarCi runtime repository (judged by scripts/hfs/runtime-check.mjs). */
export const RUNTIME_MANIFEST_FILE = 'knowledge/hfs/runtime-slots.yaml';
export const HFS_DECLARATION_FILE = 'hfs.json';
export const SIDES = Object.freeze([...PROFILES]);

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
  const escaped = entries.sort((a, b) => b.length - a.length).map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`));
  const token = new RegExp(`(^|[\\s'"\`(\\[{,;=<>])((?:${escaped.join('|')})(?=/|[\\s'"\`)\\]},;:!?<>]|\\.(?:\\s|$)|$))`, 'g');
  return (message) => (typeof message === 'string' && message
    ? message.replace(token, (whole, before, entry, offset) => (message.startsWith('/', offset + whole.length) || entry.includes('.') ? `${before}${side}/${entry}` : whole))
    : message);
}

// ------------------------------------------------------------------------------------------- manifest

/**
 * The parsed and validated manifest. `text` (or `file`, or `root`) selects the source; the default is the runtime's own
 * knowledge/hfs/slots.yaml. A manifest that fails its shape or a semantic rule is refused whole (HFS_MANIFEST_INVALID).
 */
export function loadSlotManifest({ root = skillRoot, file = path.join(root, HFS_MANIFEST_FILE), text } = {}) {
  let doc;
  try { doc = parseYamlCached(text ?? fs.readFileSync(file, 'utf8')); } catch (error) { fail('HFS_MANIFEST_INVALID', `the slot manifest cannot be read (${String(error?.message ?? error).split('\n')[0]})`, { file }); }
  const problems = manifestShapeProblems(doc);
  if (!problems.length) problems.push(...manifestSemanticProblems(doc, { varsOf, braceVariants, compileVariant }));
  if (problems.length) fail('HFS_MANIFEST_INVALID', `the slot manifest breaks its schema: ${problems.slice(0, 5).join('; ')}${problems.length > 5 ? '; and ' + (problems.length - 5) + ' more' : ''}`, { file, problems });
  const [major, minor, patch] = doc.version.split('.').map(Number);
  return Object.freeze({ ...doc, major, minor, patch });
}

// ------------------------------------------------------------------------------------- declaration

const declarationInvalid = (problems, file) => fail('HFS_DECLARATION_INVALID', `hfs.json is refused: ${problems.slice(0, 5).join('; ')}${problems.length > 5 ? '; and ' + (problems.length - 5) + ' more' : ''}`, { file, problems });

function runtimeDeclaration(manifest, declaration, file, side) {
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

const connectionView = (c) => Object.freeze({ name: c.name, envPrefix: c.envPrefix, owner: c.owner, isolation: c.isolation, ...(c.provider !== undefined ? { provider: c.provider } : {}) });

/** The declaration of one side of an app, frozen: the view a check of that side folder runs under. */
function sideDeclaration(manifest, declaration, name, edition, providers) {
  const s = declaration.sides[name];
  return Object.freeze({
    hfs: declaration.hfs,
    kind: APP_KIND,
    project: declaration.project,
    edition,
    side: name,
    profile: name,
    apps: Object.freeze(s.apps.map((a) => Object.freeze({ name: a.name, kind: a.kind }))),
    optionalSlots: Object.freeze([...(s.optionalSlots ?? [])]),
    patterns: Object.freeze([...(s.patterns ?? [])]), kinds: Object.freeze([...(s.kinds ?? [])]),
    connections: Object.freeze((s.connections ?? []).map(connectionView)),
    providers,
    reads: Object.freeze([...(s.reads ?? [])]),
    manifestVersion: manifest.version,
  });
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
  if (declaration.kind === RUNTIME_KIND) return runtimeDeclaration(manifest, declaration, file, side);
  const { edition, known, valid } = declarationEdition(manifest, declaration);
  if (!valid) fail('HFS_EDITION_INVALID', `hfs.json edition is ${JSON.stringify(declaration.edition)}; the editions this manifest knows are ${known.join(', ')} (absent means full)`, { file, edition: declaration.edition });
  const bad = PROFILES.flatMap((name) => sideProblems(manifest, name, declaration.sides[name]));
  if (bad.length) declarationInvalid(bad, file);
  if (side !== null && !PROFILES.includes(side)) fail('HFS_DECLARATION_INVALID', `${side} is not a side of an app (be, fe)`, { file, side });
  // A provider declared on any connection enables the provider slots of every profile (a fe side declares none): each view carries the union.
  const providers = Object.freeze([...new Set(PROFILES.flatMap((name) => (declaration.sides[name].connections ?? []).map((c) => c.provider).filter((p) => p !== undefined)))]);
  const sides = Object.fromEntries(PROFILES.map((name) => [name, sideDeclaration(manifest, declaration, name, edition, providers)]));
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

/**
 * The four questions for one scope: the app root (profile app, root paths) or one side (profile be or fe, paths relative to the
 * side folder). createSlotResolver composes them; nothing else calls this.
 */
function createScopeResolver(manifest, repo) {
  const profile = repo.profile;
  const edition = repo.edition ?? 'full';
  const slots = manifest.slots.filter((s) => s.profiles.includes(profile) && slotInEdition(manifest, s, edition)).map((s) => effectiveSlot(s, profile, edition));
  const scope = { manifest, repo, profile, slots, byId: new Map(slots.map((s) => [s.id, s])), variants: slots.flatMap(variantsOf), appKind: new Map(repo.apps.map((a) => [a.name, a.kind])) };
  const classifyPath = (input) => classifyIn(scope, input);
  /** tracked | ignored | external for the slot owning `p`, or null when no slot owns it. */
  const trackingOf = (p) => classifyPath(p).tracking ?? null;
  return Object.freeze({
    repo,
    slot: (id) => scope.byId.get(id) ?? null,
    slots: () => slots,
    slotEnabled: (slot) => slotEnabled(scope, slot),
    classifyPath,
    slotOf: (p) => { const c = classifyPath(p); return c.slot ? scope.byId.get(c.slot) : null; },
    ownerOf: (input) => ownerIn(scope, input),
    tierOf: (input) => tierIn(scope, input),
    importAllowed: (fromPath, toPath) => importAllowedIn(scope, fromPath, toPath),
    requiredFiles: (input) => requiredFilesIn(scope, input),
    requiredPaths: () => requiredPathsIn(scope),
    trackingOf,
    /** True only for a path a slot owns and requires to be committed. */
    isTracked: (p) => trackingOf(p) === 'tracked',
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
  return appResolver(repo, root, sides);
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
