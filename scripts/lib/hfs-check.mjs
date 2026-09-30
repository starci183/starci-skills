// hfs-check.mjs - the HFS repository check, behind `hfs check | init | explain` (packages/hfs) and reusable by any
// runtime check. It reads three things and nothing else: the repository's hfs.json, the slot manifest
// (knowledge/hfs/slots.yaml through scripts/lib/hfs-slots.mjs) and the pins (knowledge/hfs/canon-pins.yaml). It never
// writes to the repository it inspects.
//
// checkRepo() answers, for the tracked paths of one repository (git ls-files):
//   HFS_SLOT_UNDECLARED              a tracked path no slot owns (the nearest slot is named)
//   HFS_SLOT_NOT_ENABLED          a tracked path in an opt-in slot the repository did not declare
//   HFS_SLOT_AMBIGUOUS            two slots of equal specificity own the path (a manifest gap, reported not guessed)
//   HFS_TRACKED_MUST_BE_IGNORED   a tracked path in an `ignored` slot (build output, generated files)
//   HFS_FORBIDDEN_PRESENT         a tracked path in a forbidden / `external` slot; in the slot be.tool-config-local (.eslintrc*,
//                                 .eslintignore, a second eslint.config.*, another prettier or jest config) the code is HFS_TOOL_CONFIG_LOCAL instead
//   HFS_MANAGED_FILE_DRIFT, HFS_TOOL_CONFIG_LOCAL (content), HFS_TS_STRICT
//                                 the managed files: produced by packages/hfs/sync/managed.mjs, which renders the templates,
//                                 and passed in as `extraFindings` (this module does not read the templates)
//   HFS_SLOT_REQUIRED_MISSING     a file or directory a required slot (or an instance of one) must contain
//   HFS_MIN_INSTANCES             fewer instances of a slot than minInstances
//   HFS_PLAINTEXT_SECRET          (R06, hfs-rules/secrets.mjs) a plaintext secret file or value in a tracked file; a `.enc` that is no sops envelope
//   HFS_STACKS_SHAPE              (R10, hfs-rules/stacks.mjs) a `.starcistacks` path outside the standard shape, or a Sonar owner that is not the host
//   HFS_CI_MISSING_CANON          (R13, hfs-rules/pipeline.mjs) CI without the pinned `hfs check`, pre-push without typecheck or lint
//   HFS_DEP_VERSION_SKEW          (R14, hfs-rules/deps.mjs) a dependency at two versions in the workspace, or a nested copy in the lockfile
//   HFS_CONTRACT_SNAPSHOT_DRIFT   (R23, hfs-rules/contract.mjs) an uncommitted back-end snapshot, or a front-end copy that differs from it
//   BE_TEST_TOPOLOGY              (R47, hfs-rules/test-topology.mjs) a `.test` file, a testing/ folder, a second jest configuration
//   FE_NO_TESTS                   (R97, hfs-rules/fe-no-tests.mjs) a front end holds a spec, e2e or test-tool file, a test script or a test dependency; no exception
//   BE_SPEC_PLACEMENT             (R102, hfs-rules/spec-placement.mjs) a spec or test file outside the four test layers, scripts/ and tools/ included
//   HFS_REPO_LOCAL_CHECK          (R103, hfs-rules/repo-local-checks.mjs) a local eslint rule or plugin, a `check-*` script, a relative import in eslint.config
//   HFS_LINT_SUPPRESSION_FILE     (R104, hfs-rules/lint-suppression.mjs) an eslint suppressions file, script or option
//   HFS_PROOF_COMMAND_FILE_MISSING (R105, hfs-rules/proof-commands.mjs) a .starciwork proof command that runs a file the repository does not hold
//   FE_WIRE_GENERATED, FE_I18N_PLACEMENT, FE_I18N_CATALOG   (R52, R59, R60, hfs-rules/frontend.mjs) the front-end tree of each app
//   HFS_GITIGNORE_BLOCK_DRIFT, HFS_SONAR_CONFIG   (R04, R11) produced by packages/hfs/sync/managed.mjs, which renders the templates
//   HFS_FORMAT                    (R19) produced by packages/hfs/sync/format.mjs, which runs the repository's own prettier
//                                 both are passed in as `extraFindings`: this module reads no template and starts no tool
//   HFS_CANON_PIN_DRIFT           a dependency whose declared version is not the pinned one
//   BE_SOURCE_FORM                (be) a tracked src/apps .ts file whose name is not index.ts, main.ts, a migration or <kebab>.<suffix>.ts with a suffix of ruleParams.be.suffixes
//   HFS_SIZE_SOFT_BACKLOG         (info, report-only, never fails) a source file above ruleParams fileLines.soft
//   HFS_EMPTY_DIR                 a directory with no file below it (git never tracks one), outside .git, node_modules and ignored slots
//   HFS_GHOST_TREE                an empty directory beside a sibling within two edits of its name (business / bussiness)
//   HFS_UNTRACKED_ROOT_ENTRY      an entry git neither tracks nor ignores, outside an `ignored` slot (R03)
// checkRepository() is the whole `hfs check`: checkRepo() plus the architecture machine (scripts/checks/architecture.mjs, one
// implementation; the published bundle carries a byte copy), its violations and errors reported as findings under their own
// codes; `fast` limits both to the owners changed since the merge-base. Every finding carries its code and the Vietnamese why text of modules/kernel/failure-codes.yaml. Only `error`
// findings fail the check.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { ARCHITECTURE_RULE_IDS, checkArchitecture } from '../checks/architecture/index.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { HFS_DECLARATION_FILE, HfsSlotsError, createSlotResolver, loadSlotManifest, readRepoDeclaration, resolveRepoDeclaration } from './hfs-slots.mjs';
import { allowsFile } from './hfs-allows.mjs';
import { isDir } from './fs-kind.mjs';
import { gitOutput } from './git.mjs';
import { posixPath } from './path-key.mjs';
import { readTree, treeFacts, untrackedEntries } from './hfs-tree.mjs';
import { contractFindings } from './hfs-rules/contract.mjs';
import { depFindings } from './hfs-rules/deps.mjs';
import { frontendFindings } from './hfs-rules/frontend.mjs';
import { lintSuppressionFindings } from './hfs-rules/lint-suppression.mjs';
import { pipelineFindings } from './hfs-rules/pipeline.mjs';
import { proofCommandFindings } from './hfs-rules/proof-commands.mjs';
import { repoLocalCheckFindings } from './hfs-rules/repo-local-checks.mjs';
import { readJson } from './hfs-rules/read.mjs';
import { secretFindings, slotOwnsSecrets } from './hfs-rules/secrets.mjs';
import { specPlacementFindings } from './hfs-rules/spec-placement.mjs';
import { stacksFindings } from './hfs-rules/stacks.mjs';
import { testTopologyFindings } from './hfs-rules/test-topology.mjs';
import { feNoTestsFindings, isFeTestPath } from './hfs-rules/fe-no-tests.mjs';

export const CANON_PINS_FILE = 'knowledge/hfs/canon-pins.yaml';
export const FAILURE_CODES_FILE = 'modules/kernel/failure-codes.yaml';
/**
 * The codes `hfs check` and `hfs init` report when they cannot judge (an unreadable repository, a refused declaration or
 * manifest, an init that cannot proceed): infrastructure refusals, never obligations, so no rule of knowledge/hfs/rules.yaml owns them.
 */
export const REFUSAL_CODES = Object.freeze([
  'HFS_INIT_EXISTS', 'HFS_INIT_UNDETECTED', 'HFS_REPO_UNREADABLE',
  'HFS_DECLARATION_INVALID', 'HFS_MANIFEST_MAJOR_MISMATCH', 'HFS_MANIFEST_INVALID', 'HFS_FORMAT_TOOL_MISSING',
]);
/** The codes this module emits that are not the slot loader's own: the why bundle of packages/hfs ships exactly these plus the loader's. */
export const CHECK_CODES = Object.freeze([
  'HFS_SLOT_UNDECLARED', 'HFS_SLOT_NOT_ENABLED', 'HFS_SLOT_AMBIGUOUS', 'HFS_TRACKED_MUST_BE_IGNORED', 'HFS_FORBIDDEN_PRESENT',
  'HFS_SLOT_REQUIRED_MISSING', 'HFS_MIN_INSTANCES', 'HFS_CANON_PIN_DRIFT', 'HFS_SIZE_SOFT_BACKLOG', 'BE_SOURCE_FORM',
  'HFS_MANAGED_FILE_DRIFT', 'HFS_TOOL_CONFIG_LOCAL', 'HFS_RULE_OFF_WITHOUT_REPLACEMENT', 'HFS_TS_STRICT',
  'HFS_PLAINTEXT_SECRET', 'HFS_STACKS_SHAPE', 'HFS_CI_MISSING_CANON', 'HFS_DEP_VERSION_SKEW', 'HFS_CONTRACT_SNAPSHOT_DRIFT',
  'BE_TEST_TOPOLOGY', 'BE_SPEC_PLACEMENT', 'HFS_REPO_LOCAL_CHECK', 'HFS_LINT_SUPPRESSION_FILE', 'HFS_PROOF_COMMAND_FILE_MISSING', 'FE_NO_TESTS', 'FE_WIRE_GENERATED', 'FE_I18N_PLACEMENT', 'FE_I18N_CATALOG',
  'HFS_GITIGNORE_BLOCK_DRIFT', 'HFS_SONAR_CONFIG', 'HFS_FORMAT',
  'HFS_EMPTY_DIR', 'HFS_GHOST_TREE', 'HFS_UNTRACKED_ROOT_ENTRY',
  ...REFUSAL_CODES,
]);
/** Every code `hfs check` can report: its own and every code the architecture machine can emit (derived from the machine's rule id lists). */
export const ALL_CHECK_CODES = Object.freeze([...new Set([...CHECK_CODES, ...ARCHITECTURE_RULE_IDS])].sort());
const SOURCE_EXT = /\.(?:[cm]?[jt]sx?)$/;
const VAR = /<([a-z][a-z0-9-]*)>/g;
const DEP_SECTIONS = ['dependencies', 'devDependencies'];

const refuse = (code, message, details = {}) => { throw new HfsSlotsError(code, message, details); };

/** {code: {title, title_vi, meaning_vi, nextStep_vi}} for the codes asked for, read from the failure-code catalog under `root`. */
export function readWhy(root = skillRoot, codes = CHECK_CODES) {
  const catalog = parseYaml(fs.readFileSync(path.join(root, FAILURE_CODES_FILE), 'utf8'));
  const why = {};
  for (const code of codes) {
    const entry = catalog?.[code];
    if (!entry) refuse('HFS_MANIFEST_INVALID', `${FAILURE_CODES_FILE} has no entry for ${code}`, { code });
    why[code] = { title: entry.title, titleVi: entry.title_vi, whyVi: entry.meaning_vi, nextStepVi: entry.nextStep_vi };
  }
  return why;
}

/** Repository-relative tracked paths (git ls-files, posix separators; what the index holds, whatever the work tree shows). A directory that is not a Git work tree is a refusal. */
export function trackedFiles(repoRoot) {
  let out;
  try {
    out = gitOutput(['ls-files', '-z', '--cached', '--exclude-standard'], { dir: repoRoot, maxBuffer: 256 * 1024 * 1024 });
  } catch (error) {
    refuse('HFS_REPO_UNREADABLE', `${repoRoot} is not a readable Git work tree (${String(error?.stderr ?? error?.message ?? error).trim().split('\n')[0]})`, { repoRoot });
  }
  return out.split('\0').filter(Boolean).map(posixPath);
}

const fill = (text, bindings) => String(text).replace(VAR, (whole, name) => bindings[name] ?? whole);

/** hfs.json of `repoRoot` resolved against the manifest, or the single refusal finding when it is absent or invalid. */
export function openRepo({ repoRoot, root = skillRoot, manifest = loadSlotManifest({ root }) }) {
  const repo = readRepoDeclaration(manifest, repoRoot);
  return { manifest, repo, resolver: createSlotResolver(manifest, repo) };
}

const pinnedSpec = (spec, pin) => (spec === pin.version ? null : `declared ${spec}, pinned ${pin.version}`);

/** The pin map of knowledge/hfs/canon-pins.yaml under `root`. */
const readPins = (root) => parseYaml(fs.readFileSync(path.join(root, CANON_PINS_FILE), 'utf8'))?.pins ?? {};

function pinFindings({ repoRoot, files, profile, pins, only }) {
  const findings = [];
  for (const file of files.filter((f) => (f === 'package.json' || f.endsWith('/package.json')) && (!only || only.has(f)))) {
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, file), 'utf8')); } catch { continue; }
    for (const [name, pin] of Object.entries(pins)) {
      if (pin.side !== 'both' && pin.side !== profile) continue;
      for (const section of DEP_SECTIONS) {
        const spec = pkg[section]?.[name];
        if (spec === undefined) continue;
        const drift = pinnedSpec(spec, pin);
        if (drift) findings.push({ code: 'HFS_CANON_PIN_DRIFT', level: 'error', path: file, dependency: name, section, pinned: pin.version, declared: spec, message: `${name} in ${file} ${section}: ${drift}` });
      }
    }
  }
  return findings;
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SOURCE_ROOT = /^(?:src|apps)\//;
const FREE_NAMES = new Set(['index.ts', 'main.ts']);
const PLAIN_ENTRY = /^<[a-z][a-z0-9-]*>.ts$/;

/**
 * BE_SOURCE_FORM (R89): every tracked src/ or apps/ TypeScript file of a back end is index.ts, main.ts, a migration of
 * be.persistence, or <kebab-name>.<suffix>.ts with <suffix> in the closed vocabulary ruleParams.be.suffixes (a name such
 * as api.composition.spec.ts keeps its inner words kebab-case). A suffix of ruleParams.be.bannedSuffixes anywhere in the
 * name is refused by name. Paths no slot owns are HFS_SLOT_UNDECLARED's, not this code's.
 */
function sourceFormFindings({ files, resolver }) {
  const { suffixes, bannedSuffixes } = resolver.ruleParams();
  // A suffix a slot names in its own file pattern (`*.builder.ts` of be.tests.fixtures.builders) is that slot's role: a file with it
  // anywhere else is refused, so a builder cannot live beside a service or in the fixtures root.
  const boundSuffixes = new Map();
  for (const slot of resolver.slots()) {
    const bound = /\*\.([a-z0-9-]+)\.ts$/.exec(slot.path ?? '')?.[1];
    if (bound && suffixes.includes(bound)) boundSuffixes.set(bound, slot);
  }
  const findings = [];
  for (const file of files) {
    if (!file.endsWith('.ts') || !SOURCE_ROOT.test(file)) continue;
    const c = resolver.classifyPath(file);
    if (c.status !== 'owned' || c.tracking === 'ignored') continue;
    const base = path.posix.basename(file);
    if (FREE_NAMES.has(base)) continue;
    // A literal file name the owning slot itself requires or allows (persistence/connection.ts, world/global-setup.ts) is its role.
    const slot = resolver.slot(c.slot);
    if ([...(slot?.requires ?? []), ...(slot?.allows ?? [])].some((entry) => entry === base)) continue;
    // A slot whose `allows` holds a bare <name>.ts entry (be.tests.world.kit) names its files plainly, as platform/primitives does: kebab-case is the whole form.
    const admitted = allowsFile(resolver, file);
    if (admitted?.allowed && PLAIN_ENTRY.test(admitted.entry ?? '') && KEBAB.test(base.slice(0, -'.ts'.length))) continue;
    if (c.slot === 'be.persistence' && path.posix.basename(path.posix.dirname(file)) === 'migrations') continue;
    const parts = base.slice(0, -'.ts'.length).split('.');
    const banned = parts.slice(1).find((part) => bannedSuffixes.includes(part));
    if (banned) {
      findings.push({ code: 'BE_SOURCE_FORM', level: 'error', path: file, suffix: banned, message: `${file}: the suffix .${banned} is banned; use a role from the closed suffix list (${suffixes.join(', ')})` });
    } else if (boundSuffixes.has(parts.at(-1)) && parts.length >= 2 && boundSuffixes.get(parts.at(-1)).id !== c.slot) {
      findings.push({ code: 'BE_SOURCE_FORM', level: 'error', path: file, suffix: parts.at(-1), message: `${file}: the suffix .${parts.at(-1)}.ts belongs to ${boundSuffixes.get(parts.at(-1)).path} only; move the file there` });
    } else if (parts.length < 2 || !parts.every((part) => KEBAB.test(part)) || !suffixes.includes(parts.at(-1))) {
      findings.push({ code: 'BE_SOURCE_FORM', level: 'error', path: file, message: `${file}: the name must be <kebab-name>.<suffix>.ts with a suffix from the closed list (${suffixes.join(', ')}), or index.ts, main.ts or a migration` });
    }
  }
  return findings;
}

/** Instances (slot, root, bindings) present in the tracked tree, for every slot that names required files or a minimum. */
function instancesOf(resolver, files) {
  const found = new Map();
  const note = (slotId, root, bindings) => {
    const slot = resolver.slot(slotId);
    if (!slot || !(slot.requires?.length || slot.minInstances)) return;
    const key = `${slotId}|${root}`;
    if (!found.has(key)) found.set(key, { slot: slotId, root, bindings });
  };
  for (const file of files) {
    const c = resolver.classifyPath(file);
    if (c.status === 'owned') note(c.slot, c.root, c.bindings);
    const owner = c.status === 'owned' ? resolver.ownerOf(file) : null;
    if (owner) note(owner.slot, owner.root, owner.bindings);
  }
  return [...found.values()];
}

const requiredOf = (slot, instance) => (slot.requires ?? []).map((entry) => {
  const rooted = entry.startsWith('/');
  const filled = fill(rooted ? entry.slice(1) : entry, instance.bindings);
  return rooted || !instance.root ? filled : `${instance.root}/${filled}`;
});

const appOf = (p) => /^apps\/([^/]+)\//.exec(p)?.[1];

function withWhy(findings, why) {
  return findings.map((f) => ({ ...f, title: why[f.code].title, titleVi: why[f.code].titleVi, whyVi: why[f.code].whyVi, nextStepVi: why[f.code].nextStepVi }));
}

function summarize(findings) {
  const byCode = {};
  for (const f of findings) {
    byCode[f.code] ??= { level: f.level, count: 0 };
    byCode[f.code].count += 1;
  }
  return {
    error: findings.filter((f) => f.level === 'error').length,
    info: findings.filter((f) => f.level === 'info').length,
    byCode,
  };
}

/** The tree findings of R03: empty directories, ghost siblings, untracked entries outside an ignored slot. */
function treeFindings({ repoRoot, resolver }) {
  const inIgnoredSlot = (rel) => resolver.classifyPath(`${rel}/.probe`).tracking === 'ignored';
  const findings = [];
  const facts = treeFacts(readTree(repoRoot, { isIgnored: inIgnoredSlot }));
  for (const { path: dir, below } of facts.empty) {
    findings.push({ code: 'HFS_EMPTY_DIR', level: 'error', path: dir, below, message: `${dir} has no file below it${below ? ` (nor in its ${below} sub-director${below === 1 ? 'y' : 'ies'})` : ''}; git tracks no empty directory, so it is a leftover` });
  }
  for (const { path: dir, of, distance } of facts.ghosts) {
    findings.push({ code: 'HFS_GHOST_TREE', level: 'error', path: dir, of, distance, message: `${dir} is empty and ${distance} edit${distance === 1 ? '' : 's'} from its sibling ${of}: a renamed or misspelt structure that was never removed` });
  }
  for (const entry of untrackedEntries(repoRoot)) {
    const bare = entry.replace(/\/$/, '');
    const ignored = entry.endsWith('/') ? inIgnoredSlot(bare) : resolver.classifyPath(bare).tracking === 'ignored';
    if (!ignored) findings.push({ code: 'HFS_UNTRACKED_ROOT_ENTRY', level: 'error', path: bare, message: `${entry} is neither tracked nor git-ignored, and no ignored slot owns it` });
  }
  return findings;
}

/**
 * The check of one repository. `declaration` overrides hfs.json (a dry run over a repository that has none); `files`
 * overrides git ls-files (specs). `only` (a list of paths) limits the per-path checks (slot, pin, size) to those paths; the
 * checks of the tree as a whole (required files, minimum instances, empty directories, untracked entries) are not
 * per-path. `tree: false` skips the file-system checks (empty directories, ghosts, untracked); they also do not run
 * over `files`, which is a dry run. `extraFindings` are findings another emitter produced for the same repository (the
 * managed files), judged and counted with this module's own. Returns {ok, profile, apps, manifest, tracked, findings,
 * counts}; a missing or invalid hfs.json is one HFS_DECLARATION_INVALID / HFS_MANIFEST_MAJOR_MISMATCH error finding, never
 * an exception.
 */
export function checkRepo({ repoRoot, root = skillRoot, declaration, files, only, extraFindings = [], tree = files === undefined, manifest = loadSlotManifest({ root }) }) {
  const why = readWhy(root);
  let repo;
  try {
    repo = declaration === undefined ? readRepoDeclaration(manifest, repoRoot) : resolveRepoDeclaration(manifest, declaration);
  } catch (error) {
    if (!(error instanceof HfsSlotsError) || !['HFS_DECLARATION_INVALID', 'HFS_MANIFEST_MAJOR_MISMATCH'].includes(error.code)) throw error;
    const findings = withWhy([{ code: error.code, level: 'error', path: HFS_DECLARATION_FILE, message: error.message.replace(/^[A-Z_]+: /, ''), problems: error.details.problems }], why);
    return { ok: false, repoRoot, manifest: manifest.version, profile: null, apps: [], tracked: 0, findings, counts: summarize(findings) };
  }
  const resolver = createSlotResolver(manifest, repo);
  const tracked = files ?? trackedFiles(repoRoot);
  const trackedSet = new Set(tracked);
  const present = (p) => (p.endsWith('/') ? tracked.some((f) => f.startsWith(p)) : trackedSet.has(p));
  const findings = [];
  const scoped = only ? new Set(only) : null;
  const inScope = (file) => !scoped || scoped.has(file);

  for (const file of tracked) {
    if (!inScope(file)) continue;
    if (repo.profile === 'fe' && isFeTestPath(file)) continue;   // a test path of a front end is FE_NO_TESTS's, the one finding of that file
    const c = resolver.classifyPath(file);
    if (c.status === 'no-slot') {
      findings.push({ code: 'HFS_SLOT_UNDECLARED', level: 'error', path: file, nearest: c.nearest, message: `${file} matches no slot${c.nearest ? `; nearest slot ${c.nearest.slot} (${c.nearest.pattern}), matched ${c.nearest.matchedPrefix || '.'} then expected ${c.nearest.expectedNext ?? 'nothing'}` : ''}` });
    } else if (c.status === 'ambiguous') {
      findings.push({ code: 'HFS_SLOT_AMBIGUOUS', level: 'error', path: file, candidates: c.candidates, message: `${file} is owned equally by ${c.candidates.map((x) => x.slot ?? x).join(', ')}` });
    } else if (c.status === 'not-enabled') {
      findings.push({ code: 'HFS_SLOT_NOT_ENABLED', level: 'error', path: file, slot: c.slot, message: `${file} belongs to ${c.slot}, an opt-in slot hfs.json neither lists in optionalSlots nor implies through an app kind` });
    } else if (c.status === 'forbidden') {
      const slot = resolver.slot(c.slot);
      if (slotOwnsSecrets(slot)) continue;   // the secret scan reports the file (R06): one finding per file
      const own = slot.rules?.includes('HFS_TOOL_CONFIG_LOCAL') ? 'HFS_TOOL_CONFIG_LOCAL' : 'HFS_FORBIDDEN_PRESENT';
      findings.push({ code: own, level: 'error', path: file, slot: c.slot, goesTo: c.goesTo, message: `${file} is tracked but ${c.slot} is forbidden in the tree${c.goesTo ? `; it belongs at ${c.goesTo}` : ''}` });
    } else if (c.tracking === 'ignored') {
      findings.push({ code: 'HFS_TRACKED_MUST_BE_IGNORED', level: 'error', path: file, slot: c.slot, message: `${file} is tracked but ${c.slot} must be gitignored` });
    }
  }

  const required = resolver.requiredPaths();
  const missing = new Set();
  const missingFile = (slot, p, via) => {
    const key = `${slot}|${p}`;
    if (missing.has(key) || present(p)) return;
    missing.add(key);
    const app = appOf(p);
    findings.push({ code: 'HFS_SLOT_REQUIRED_MISSING', level: 'error', path: p, slot, via, ...(app ? { app } : {}), message: `${slot} requires ${p}${app ? ` (app ${app})` : ''}, which is not tracked` });
  };
  for (const entry of required.paths) missingFile(entry.slot, entry.path, entry.via);
  const instances = instancesOf(resolver, tracked);
  for (const instance of instances) for (const p of requiredOf(resolver.slot(instance.slot), instance)) missingFile(instance.slot, p, 'requires');
  for (const { slot, min, appKind } of required.minimums) {
    if (appKind !== undefined) continue;     // an app-kind minimum is checked by requiredPaths (one path set per declared app)
    const count = instances.filter((i) => i.slot === slot).length;
    if (count < min) findings.push({ code: 'HFS_MIN_INSTANCES', level: 'error', path: resolver.slot(slot).path, slot, min, count, message: `${slot} needs at least ${min} instance${min === 1 ? '' : 's'} (${resolver.slot(slot).path}), found ${count}` });
  }

  const pins = readPins(root);
  findings.push(...pinFindings({ repoRoot, files: tracked, profile: repo.profile, pins, only: scoped }));

  // The tree checks of the rules that read file content or configuration (hfs-rules/*): whole-repository, cheap, no tool run.
  const secrets = secretFindings({ repoRoot, files: tracked.filter(inScope), resolver });
  const declared = declaration === undefined ? readJson(repoRoot, 'hfs.json') : declaration;
  if (repo.profile === 'be') findings.push(...sourceFormFindings({ files: tracked.filter(inScope), resolver }));
  findings.push(
    ...secrets,
    ...depFindings({ repoRoot, files: tracked }),
    ...pipelineFindings({ repoRoot, files: tracked, pins }),
    ...contractFindings({ repoRoot, files: tracked, repo, resolver, stacks: declared?.stacks }),
    ...repoLocalCheckFindings({ repoRoot, files: tracked }),
    ...lintSuppressionFindings({ repoRoot, files: tracked }),
    ...(repo.profile === 'be' ? [...stacksFindings({ repoRoot, files: tracked, resolver }), ...testTopologyFindings({ repoRoot, files: tracked }), ...specPlacementFindings({ files: tracked, resolver }), ...proofCommandFindings({ repoRoot, files: tracked, resolver })] : [...frontendFindings({ repoRoot, files: tracked, repo }), ...feNoTestsFindings({ repoRoot, files: tracked.filter(inScope) })]),
    ...extraFindings,
  );

  const soft = resolver.ruleParams().fileLines.soft;
  for (const file of tracked) {
    if (!inScope(file) || !SOURCE_EXT.test(file) || resolver.classifyPath(file).status !== 'owned') continue;
    let lines;
    try { lines = fs.readFileSync(path.join(repoRoot, file), 'utf8').split('\n').length; } catch { continue; }
    if (lines > soft) findings.push({ code: 'HFS_SIZE_SOFT_BACKLOG', level: 'info', path: file, lines, soft, message: `${file} has ${lines} lines, above the soft size ${soft}; report only` });
  }

  if (tree) findings.push(...treeFindings({ repoRoot, resolver }));

  const finished = withWhy(findings, why);
  const counts = summarize(finished);
  return { ok: counts.error === 0, repoRoot, manifest: manifest.version, profile: repo.profile, apps: repo.apps, tracked: tracked.length, findings: finished, counts };
}

// ------------------------------------------------------------------------------------------ the whole check

const gitOut = (repoRoot, args) => gitOutput(args, { dir: repoRoot, maxBuffer: 256 * 1024 * 1024 });

/** The merge-base of HEAD with `base`, else with origin/main, else with main; null when none resolves. */
function mergeBaseOf(repoRoot, base) {
  for (const ref of base ? [base] : ['origin/main', 'main']) {
    try {
      const sha = gitOut(repoRoot, ['merge-base', 'HEAD', ref]).trim();
      if (sha) return sha;
    } catch { /* this ref has no merge-base with HEAD; try the next */ }
  }
  return null;
}

/** Tracked paths that differ from the merge-base (commits, staged and unstaged edits; deletions are not paths to judge). */
export function changedSince(repoRoot, base) {
  const sha = mergeBaseOf(repoRoot, base);
  if (!sha) {
    throw new Error(base
      ? `--base ${base} has no merge-base with HEAD; pass a ref this branch descends from`
      : '--fast needs a merge-base with origin/main or main and found none; run `git fetch origin main` or pass --base <ref>');
  }
  const files = gitOut(repoRoot, ['diff', '--name-only', '--diff-filter=ACMRT', '-z', sha]).split('\0').filter(Boolean).map(posixPath);
  return { base: sha, files };
}

/** The machine's violations and errors as findings: each keeps the machine's rule id as its code. */
function machineFindings(report) {
  const of = (item) => ({ code: item.ruleId, level: 'error', ...(item.path ? { path: item.path } : {}), ...(item.line ? { line: item.line, column: item.column } : {}), source: 'machine', message: `${item.path ? `${item.path}${item.line ? `:${item.line}` : ''}: ` : ''}${item.message}` });
  return [...report.errors.map(of), ...report.violations.map(of)];
}

/**
 * The whole `hfs check` of one repository: checkRepo() (slots, pins, size, tree) and then the architecture machine over the
 * same work tree, its violations and errors merged in as findings with the Vietnamese why of their codes. `fast` judges
 * only what changed since the merge-base (`base` names another ref): the per-path slot and pin checks on the changed
 * paths, the machine on the owners of the changed source files without clones and dead exports, and no file-system tree
 * checks. `extraFindings` are the findings of the emitters that render templates or run the repository's formatter
 * (packages/hfs/sync), judged with checkRepo's own. `machine` is injectable for specs. A missing merge-base under `fast` is an Error, never a silent full pass.
 */
export function checkRepository({ repoRoot, root = skillRoot, fast = false, base, extraFindings = [], manifest = loadSlotManifest({ root }), machine = checkArchitecture }) {
  const changed = fast ? changedSince(repoRoot, base) : null;
  const baseSha = changed ? changed.base : (base ? (mergeBaseOf(repoRoot, base) ?? refuse('HFS_REPO_UNREADABLE', `--base ${base} has no merge-base with HEAD`, { repoRoot, base })) : undefined);
  const slotResult = checkRepo({ repoRoot, root, manifest, extraFindings, ...(changed ? { only: changed.files, tree: false } : {}) });
  if (slotResult.profile === null) return { ...slotResult, machine: { status: 'skipped', reason: 'hfs.json is not valid' } };

  let paths;
  if (changed) {
    const resolver = createSlotResolver(manifest, readRepoDeclaration(manifest, repoRoot));
    paths = [...new Set(changed.files.filter((f) => SOURCE_EXT.test(f) || resolver.ownerOf(f)).map((f) => resolver.ownerOf(f)?.root ?? f))].sort();
    if (!paths.length) return { ...slotResult, machine: { status: 'skipped', reason: 'no changed source file', base: changed.base }, fast: { base: changed.base, changed: changed.files.length } };
  }
  let report;
  try {
    report = machine({ repositoryRoot: repoRoot, base: baseSha, ...(changed ? { paths, fast: true } : {}) });
  } catch (error) {
    report = { ok: false, files: 0, kinds: [], violations: [], errors: [{ ruleId: 'ARCH_EXECUTION_UNAVAILABLE', message: String(error?.message ?? error) }] };
  }
  const found = machineFindings(report);
  const why = readWhy(root, [...new Set(found.map((f) => f.code))]);
  const findings = [...slotResult.findings, ...withWhy(found, why)];
  const counts = summarize(findings);
  return {
    ...slotResult,
    ok: counts.error === 0,
    findings,
    counts,
    machine: { status: 'ran', files: report.files, kinds: report.kinds, ...(changed ? { paths, base: changed.base } : {}) },
    ...(changed ? { fast: { base: changed.base, changed: changed.files.length } } : {}),
  };
}

// --------------------------------------------------------------------------------------------------- explain

const TEST_KIND = {
  'unit-beside': 'a <name>.service.spec.ts beside each <name>.service.ts in this slot (only services are unit-tested)',
  e2e: 'an integration, e2e or contract spec covering the flow; no unit spec is required',
  none: 'no test is required for files in this slot',
};

/** What owns `input` and what that means: slot, tier, allowed imports, required tests, required files. */
export function explainPath({ repoRoot, input, root = skillRoot, declaration, manifest = loadSlotManifest({ root }) }) {
  const repo = declaration === undefined ? readRepoDeclaration(manifest, repoRoot) : resolveRepoDeclaration(manifest, declaration);
  const resolver = createSlotResolver(manifest, repo);
  const why = readWhy(root);
  const c = resolver.classifyPath(input);
  if (c.status === 'no-slot') {
    return { path: c.path, status: 'no-slot', code: 'HFS_SLOT_UNDECLARED', nearest: c.nearest, titleVi: why.HFS_SLOT_UNDECLARED.titleVi, whyVi: why.HFS_SLOT_UNDECLARED.whyVi };
  }
  if (c.status === 'ambiguous') return { path: c.path, status: 'ambiguous', code: 'HFS_SLOT_AMBIGUOUS', candidates: c.candidates, titleVi: why.HFS_SLOT_AMBIGUOUS.titleVi, whyVi: why.HFS_SLOT_AMBIGUOUS.whyVi };
  const slot = resolver.slot(c.slot);
  const tier = resolver.tierOf(c.path);
  const owner = resolver.ownerOf(c.path);
  const mayImport = tier && tier !== 'none' ? resolver.allowedImports(tier) : null;
  return {
    path: c.path,
    status: c.status,
    slot: slot.id,
    pattern: slot.path,
    presence: slot.presence,
    tracking: slot.tracked,
    tier: tier ?? 'none',
    owner: owner ? { slot: owner.slot, root: owner.root } : null,
    allowedImports: mayImport,
    importRule: mayImport ? manifest.crossOwner : (tier === 'none' ? 'the slot takes no part in import checks' : null),
    tests: slot.tests,
    testsMeaning: TEST_KIND[slot.tests],
    requiredFiles: resolver.requiredFiles(c.path),
    ...(slot.goesTo ? { goesTo: slot.goesTo } : {}),
    ...(slot.rules ? { rules: slot.rules } : {}),
    ...(c.status === 'forbidden' ? { code: 'HFS_FORBIDDEN_PRESENT', titleVi: why.HFS_FORBIDDEN_PRESENT.titleVi, whyVi: why.HFS_FORBIDDEN_PRESENT.whyVi } : {}),
    ...(c.status === 'not-enabled' ? { code: 'HFS_SLOT_NOT_ENABLED', titleVi: why.HFS_SLOT_NOT_ENABLED.titleVi, whyVi: why.HFS_SLOT_NOT_ENABLED.whyVi } : {}),
  };
}

// ------------------------------------------------------------------------------------------------- init

const SLUG_SUFFIX = /-(backend|be|frontend|fe|api|web|app)$/;
const exists = (p) => fs.existsSync(p);
const readPackage = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch { return null; } };
const depsOf = (pkg) => ({ ...pkg?.devDependencies, ...pkg?.dependencies });

/**
 * A starter hfs.json by detection: profile from the dependencies (next -> fe, @nestjs/core -> be, over the root and
 * every apps/<name>), apps from the apps/<name> directories (fe: kind next; be: worker/migrate/cli by name, else api).
 * optionalSlots are the opt-in slots (not implied by an app kind) that tracked files already occupy. Connections are not guessed; a repository that keeps a database declares them by hand and gains the migrate app.
 * A repository the detection cannot classify is HFS_INIT_UNDETECTED, never a guess.
 */
export function detectDeclaration({ repoRoot, manifest }) {
  const appsDir = path.join(repoRoot, 'apps');
  const names = isDir(appsDir) ? fs.readdirSync(appsDir, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== 'node_modules').map((e) => e.name).sort() : [];
  const rootPkg = readPackage(repoRoot);
  const all = { ...depsOf(rootPkg) };
  for (const name of names) Object.assign(all, depsOf(readPackage(path.join(appsDir, name))));
  const isFe = 'next' in all || names.some((n) => ['next.config.ts', 'next.config.js', 'next.config.mjs'].some((f) => exists(path.join(appsDir, n, f))));
  const isBe = '@nestjs/core' in all || exists(path.join(repoRoot, 'nest-cli.json'));
  if (isFe === isBe) refuse('HFS_INIT_UNDETECTED', `cannot tell the profile of ${repoRoot}: ${isFe ? 'both next and Nest are present' : 'neither next nor @nestjs/core is declared'}`, { repoRoot });
  const profile = isFe ? 'fe' : 'be';
  const apps = names.map((name) => {
    if (profile === 'fe') return { name, kind: 'next' };
    if (!isDir(path.join(appsDir, name, 'src'))) return null;
    const kind = /migrat/.test(name) ? 'migrate' : (/worker/.test(name) ? 'worker' : (/(^|-)cli($|-)/.test(name) ? 'cli' : 'api'));
    return { name, kind };
  }).filter(Boolean).filter((a) => manifest.appKinds[profile].includes(a.kind));
  if (!apps.length) refuse('HFS_INIT_UNDETECTED', `${repoRoot} has no apps/<name> ${profile === 'fe' ? 'Next application' : 'Nest application with a src directory'} to declare`, { repoRoot, profile });
  const project = String(rootPkg?.name ?? path.basename(repoRoot)).replace(/^@[^/]+\//, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').replace(SLUG_SUFFIX, '');
  const declaration = { hfs: manifest.major, profile, project: /^[a-z]/.test(project) ? project : `p-${project}`, apps };
  const optionalSlots = occupiedOptInSlots({ repoRoot, manifest, declaration });
  return optionalSlots.length ? { ...declaration, optionalSlots } : declaration;
}

/** The opt-in slots (not enabled by an app kind) that at least one tracked file falls in, found by enabling them all for a look. */
function occupiedOptInSlots({ repoRoot, manifest, declaration }) {
  let files;
  try { files = trackedFiles(repoRoot); } catch (error) { if (error.code === 'HFS_REPO_UNREADABLE') return []; throw error; }
  const optIn = manifest.slots.filter((s) => s.profiles.includes(declaration.profile) && s.presence === 'opt-in' && s.appKind === undefined).map((s) => s.id);
  const everything = createSlotResolver(manifest, resolveRepoDeclaration(manifest, { ...declaration, optionalSlots: optIn }));
  const used = new Set();
  for (const file of files) { const c = everything.classifyPath(file); if (c.status === 'owned' && optIn.includes(c.slot)) used.add(c.slot); }
  return optIn.filter((id) => used.has(id));
}

/** Write hfs.json unless one exists (HFS_INIT_EXISTS); `write: false` returns the text only. */
export function initRepo({ repoRoot, root = skillRoot, write = true, manifest = loadSlotManifest({ root }) }) {
  const file = path.join(repoRoot, HFS_DECLARATION_FILE);
  if (write && exists(file)) refuse('HFS_INIT_EXISTS', `${file} already exists; init never rewrites a declaration`, { file });
  const declaration = detectDeclaration({ repoRoot, manifest });
  resolveRepoDeclaration(manifest, declaration);
  const text = `${JSON.stringify(declaration, null, 2)}\n`;
  if (write) fs.writeFileSync(file, text);
  return { file, declaration, text, written: write };
}
