// hfs-check.mjs - the HFS repository check, behind `hfs check | init | explain` (packages/hfs) and reusable by any
// runtime check. It reads three things and nothing else: the repository's hfs.json, the slot manifest
// (knowledge/hfs/slots.yaml through scripts/lib/hfs-slots.mjs) and the pins (knowledge/hfs/canon-pins.yaml). It never
// writes to the repository it inspects.
//
// checkRepo() answers, for the tracked paths of one repository (git ls-files):
//   HFS_PATH_NO_SLOT              a tracked path no slot owns (the nearest slot is named)
//   HFS_SLOT_NOT_ENABLED          a tracked path in an opt-in slot the repository did not declare
//   HFS_SLOT_AMBIGUOUS            two slots of equal specificity own the path (a manifest gap, reported not guessed)
//   HFS_TRACKED_MUST_BE_IGNORED   a tracked path in an `ignored` slot (build output, generated files)
//   HFS_FORBIDDEN_PRESENT         a tracked path in a forbidden / `external` slot
//   HFS_REQUIRED_MISSING          a file or directory a required slot (or an instance of one) must contain
//   HFS_MIN_INSTANCES             fewer instances of a slot than minInstances
//   HFS_CANON_PIN_DRIFT           a dependency whose declared version is not the pinned one
//   HFS_SIZE_SOFT_BACKLOG         (info, report-only, never fails) a source file above ruleParams fileLines.soft
// Every finding carries its code and the Vietnamese why text of modules/kernel/failure-codes.yaml. Only `error`
// findings fail the check.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { HFS_DECLARATION_FILE, HfsSlotsError, createSlotResolver, loadSlotManifest, readRepoDeclaration, resolveRepoDeclaration } from './hfs-slots.mjs';
import { posixPath } from './path-key.mjs';

export const CANON_PINS_FILE = 'knowledge/hfs/canon-pins.yaml';
export const FAILURE_CODES_FILE = 'modules/kernel/failure-codes.yaml';
/** The codes this module emits that are not the slot loader's own: the why bundle of packages/hfs ships exactly these plus the loader's. */
export const CHECK_CODES = Object.freeze([
  'HFS_PATH_NO_SLOT', 'HFS_SLOT_NOT_ENABLED', 'HFS_SLOT_AMBIGUOUS', 'HFS_TRACKED_MUST_BE_IGNORED', 'HFS_FORBIDDEN_PRESENT',
  'HFS_REQUIRED_MISSING', 'HFS_MIN_INSTANCES', 'HFS_CANON_PIN_DRIFT', 'HFS_SIZE_SOFT_BACKLOG',
  'HFS_INIT_EXISTS', 'HFS_INIT_UNDETECTED', 'HFS_REPO_UNREADABLE',
  'HFS_DECLARATION_INVALID', 'HFS_MANIFEST_MAJOR_MISMATCH', 'HFS_MANIFEST_INVALID',
]);
const SOURCE_EXT = /\.(?:[cm]?[jt]sx?)$/;
const VAR = /<([a-z][a-z0-9-]*)>/g;
const DEP_SECTIONS = ['dependencies', 'devDependencies'];

const refuse = (code, message, details = {}) => { throw new HfsSlotsError(code, message, details); };

/** {code: {title_vi, meaning_vi, nextStep_vi}} for the codes asked for, read from the failure-code catalog under `root`. */
export function readWhy(root = skillRoot, codes = CHECK_CODES) {
  const catalog = parseYaml(fs.readFileSync(path.join(root, FAILURE_CODES_FILE), 'utf8'));
  const why = {};
  for (const code of codes) {
    const entry = catalog?.[code];
    if (!entry) refuse('HFS_MANIFEST_INVALID', `${FAILURE_CODES_FILE} has no entry for ${code}`, { code });
    why[code] = { titleVi: entry.title_vi, whyVi: entry.meaning_vi, nextStepVi: entry.nextStep_vi };
  }
  return why;
}

/** Repository-relative tracked paths (git ls-files, posix separators; what the index holds, whatever the work tree shows). A directory that is not a Git work tree is a refusal. */
export function trackedFiles(repoRoot) {
  let out;
  try {
    out = execFileSync('git', ['-C', repoRoot, 'ls-files', '-z', '--cached', '--exclude-standard'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
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

function pinFindings({ repoRoot, files, profile, root }) {
  const pins = parseYaml(fs.readFileSync(path.join(root, CANON_PINS_FILE), 'utf8'))?.pins ?? {};
  const findings = [];
  for (const file of files.filter((f) => f === 'package.json' || f.endsWith('/package.json'))) {
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
  return findings.map((f) => ({ ...f, titleVi: why[f.code].titleVi, whyVi: why[f.code].whyVi, nextStepVi: why[f.code].nextStepVi }));
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

/**
 * The check of one repository. `declaration` overrides hfs.json (a dry run over a repository that has none); `files`
 * overrides git ls-files (specs). Returns {ok, profile, apps, manifest, tracked, findings, counts}; a missing or invalid
 * hfs.json is one HFS_DECLARATION_INVALID / HFS_MANIFEST_MAJOR_MISMATCH error finding, never an exception.
 */
export function checkRepo({ repoRoot, root = skillRoot, declaration, files, manifest = loadSlotManifest({ root }) }) {
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

  for (const file of tracked) {
    const c = resolver.classifyPath(file);
    if (c.status === 'no-slot') {
      findings.push({ code: 'HFS_PATH_NO_SLOT', level: 'error', path: file, nearest: c.nearest, message: `${file} matches no slot${c.nearest ? `; nearest slot ${c.nearest.slot} (${c.nearest.pattern}), matched ${c.nearest.matchedPrefix || '.'} then expected ${c.nearest.expectedNext ?? 'nothing'}` : ''}` });
    } else if (c.status === 'ambiguous') {
      findings.push({ code: 'HFS_SLOT_AMBIGUOUS', level: 'error', path: file, candidates: c.candidates, message: `${file} is owned equally by ${c.candidates.map((x) => x.slot ?? x).join(', ')}` });
    } else if (c.status === 'not-enabled') {
      findings.push({ code: 'HFS_SLOT_NOT_ENABLED', level: 'error', path: file, slot: c.slot, message: `${file} belongs to ${c.slot}, an opt-in slot hfs.json neither lists in optionalSlots nor implies through an app kind` });
    } else if (c.status === 'forbidden') {
      findings.push({ code: 'HFS_FORBIDDEN_PRESENT', level: 'error', path: file, slot: c.slot, goesTo: c.goesTo, message: `${file} is tracked but ${c.slot} is forbidden in the tree${c.goesTo ? `; it belongs at ${c.goesTo}` : ''}` });
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
    findings.push({ code: 'HFS_REQUIRED_MISSING', level: 'error', path: p, slot, via, ...(app ? { app } : {}), message: `${slot} requires ${p}${app ? ` (app ${app})` : ''}, which is not tracked` });
  };
  for (const entry of required.paths) missingFile(entry.slot, entry.path, entry.via);
  const instances = instancesOf(resolver, tracked);
  for (const instance of instances) for (const p of requiredOf(resolver.slot(instance.slot), instance)) missingFile(instance.slot, p, 'requires');
  for (const { slot, min, appKind } of required.minimums) {
    if (appKind !== undefined) continue;     // an app-kind minimum is checked by requiredPaths (one path set per declared app)
    const count = instances.filter((i) => i.slot === slot).length;
    if (count < min) findings.push({ code: 'HFS_MIN_INSTANCES', level: 'error', path: resolver.slot(slot).path, slot, min, count, message: `${slot} needs at least ${min} instance${min === 1 ? '' : 's'} (${resolver.slot(slot).path}), found ${count}` });
  }

  findings.push(...pinFindings({ repoRoot, files: tracked, profile: repo.profile, root }));

  const soft = resolver.ruleParams().fileLines.soft;
  for (const file of tracked) {
    if (!SOURCE_EXT.test(file) || resolver.classifyPath(file).status !== 'owned') continue;
    let lines;
    try { lines = fs.readFileSync(path.join(repoRoot, file), 'utf8').split('\n').length; } catch { continue; }
    if (lines > soft) findings.push({ code: 'HFS_SIZE_SOFT_BACKLOG', level: 'info', path: file, lines, soft, message: `${file} has ${lines} lines, above the soft size ${soft}; report only` });
  }

  const finished = withWhy(findings, why);
  const counts = summarize(finished);
  return { ok: counts.error === 0, repoRoot, manifest: manifest.version, profile: repo.profile, apps: repo.apps, tracked: tracked.length, findings: finished, counts };
}

// --------------------------------------------------------------------------------------------------- explain

const TEST_KIND = {
  'unit-beside': 'a unit spec beside each source file (<name>.spec.ts / .spec.tsx) in this slot',
  e2e: 'an e2e spec (*.e2e-spec.ts or a Playwright spec) covering the flow; no unit spec is required',
  none: 'no test is required for files in this slot',
};

/** What owns `input` and what that means: slot, tier, allowed imports, required tests, required files. */
export function explainPath({ repoRoot, input, root = skillRoot, declaration, manifest = loadSlotManifest({ root }) }) {
  const repo = declaration === undefined ? readRepoDeclaration(manifest, repoRoot) : resolveRepoDeclaration(manifest, declaration);
  const resolver = createSlotResolver(manifest, repo);
  const why = readWhy(root);
  const c = resolver.classifyPath(input);
  if (c.status === 'no-slot') {
    return { path: c.path, status: 'no-slot', code: 'HFS_PATH_NO_SLOT', nearest: c.nearest, titleVi: why.HFS_PATH_NO_SLOT.titleVi, whyVi: why.HFS_PATH_NO_SLOT.whyVi };
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
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
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
