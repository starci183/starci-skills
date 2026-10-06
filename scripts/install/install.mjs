#!/usr/bin/env node
// The installer for StarCi. The runtime is a tree of files under <repo>/.claude plus one managed
// bootstrap file at the repo root (AGENTS.md by default; CLAUDE.md/DEVIN.md only when the host opts
// in via --hosts). Nothing here is a framework the tree depends on at run time. Runtime
// dependencies and supported Node branches are declared in package.json.
//
//   starci runtime install     install the tree into ./.claude and write the bootstrap
//   starci runtime update      bring an installed tree to this package's version
//   starci runtime doctor      run the tree's own validators on the installed copy
//   starci runtime version
//
// Every command takes --dir <repo> (default: the current directory). init refuses a non-empty
// .claude it did not install unless --force; update keeps a file a person changed locally unless
// --force; neither ever runs a git command.
import {SECRET_ENV_FILE} from '../../engine/secrets.mjs';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, rmdirSync, statSync, lstatSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { runNode } from '../api/node/run-node.mjs';
import {runNpm} from '../api/npm/run-npm.mjs';
import {isLinkLike} from '../api/fs/is-link-like.mjs';
import { fileURLToPath } from 'node:url';
import { isMain } from '../lib/is-main.mjs';
import {EXAMPLE_CATALOG_FILE} from '../lib/example-refs.mjs';
import {PAYLOAD, isNegated, payloadFiles, hashTree, payloadHash as sha, copyPayload} from './payload.mjs';
export {PAYLOAD, payloadFiles};
import {entrySkillsPlan, applyEntrySkillsPlan} from './entry-skills.mjs';
import {doctorInstallation} from './doctor.mjs';
import {HOST_BOOTSTRAP_FILES, parseHosts} from './bootstrap-hosts.mjs';
import {runInitialAgeInstall, AGE_TOOL_REASONS} from './initial-age.mjs';
import {selectedAgeVersions} from '../api/sops/selected-age-versions.mjs';
export {entrySkillsPlan, applyEntrySkillsPlan};

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

// ENGINE_SCHEMA names the durable workflow protocol marker recorded in the install manifest. It lives
// in engine/constants.mjs — which is itself payload, so a partially written package may not have it.
// Resolve lazily: version/help must still answer on a broken tree; init/update/doctor fail loudly.
const engineConstants = await import('../../engine/constants.mjs').catch((error) => {
  if (error?.code === 'ERR_MODULE_NOT_FOUND' && String(error?.message ?? '').includes('constants.mjs')) return null;
  throw error;
});
const requireEngineSchema = () => {
  if (typeof engineConstants?.ENGINE_SCHEMA !== 'string') throw new Error('package is incomplete: engine/constants.mjs is missing');
  return engineConstants.ENGINE_SCHEMA;
};

import { INSTALL_MANIFEST_FILE as MANIFEST, INSTALL_PROTOCOL_SCHEMA } from '../lib/install-custody.mjs';
// The durable workflow protocol an installed tree speaks, independent of public semver: named by the
// engine schema it enrolls workflows into, ranked by that schema's number. The installer accepts only
// the marker it writes itself - anything older is cleaned by hand, never upgraded by code.
const installProtocol = () => Object.freeze({ schema: INSTALL_PROTOCOL_SCHEMA, engine: requireEngineSchema() });
const engineRank = (engine) => { const m = /^starci\/engine@(\d+)$/.exec(String(engine ?? '')); return m ? Number(m[1]) : null; };
// Local owner files stay outside installer custody and Git even under a forced update.
const INSTALLED_IGNORES = ['/config.yaml', `/${SECRET_ENV_FILE}`];
// .claude/.runtime/ is the host state directory (engine/runtime-root.mjs): inside the app's repository, so the app must ignore it.
const HOST_IGNORES = ['.starciwork/', ...INSTALLED_IGNORES.map(entry => '.claude' + entry), '.claude/.runtime/'];
const ENTRY_MARKER = '<!-- starci:prompt-entry -->';
const entryOf = text => text.match(/<!-- starci:prompt-entry -->[\s\S]*?<!-- \/starci:prompt-entry -->/)?.[0];

// The one shipped template. CLAUDE.md/DEVIN.md are not stored: when a host opts into those names the
// installer writes byte-identical copies of this same file.
const BOOTSTRAP = readFileSync(path.join(packageRoot, 'init/AGENTS.md'), 'utf8');
const PROMPT_ENTRY = entryOf(BOOTSTRAP);
if (!PROMPT_ENTRY) throw new Error('init/AGENTS.md must carry the managed starci:prompt-entry block');

function selectedProfile(opts) {
  if (opts.profile !== undefined && opts.profile !== 'full') throw new Error('only the full profile exists');
  return 'full';
}

// Hosts the installer can write a bootstrap for (bootstrap-hosts.mjs, also read by `starci runtime check --only entry`). AGENTS.md is always the
// canonical write; claude/devin emit copies of the same template only when the host names them (`--hosts claude,devin` or `all`).
const HOST_BOOTSTRAP_NAMES = Object.values(HOST_BOOTSTRAP_FILES);

function parseArgs(argv) {
  const out = { command: argv[0] ?? 'help', dir: process.cwd(), force: false, quick: false, bootstrap: true, hosts: [] };
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dir') out.dir = path.resolve(argv[++i] ?? '.');
    else if (a.startsWith('--dir=')) out.dir = path.resolve(a.slice(6));
    else if (a === '--profile') out.profile = argv[++i];
    else if (a.startsWith('--profile=')) out.profile = a.slice(10);
    else if (a === '--hosts') out.hosts = parseHosts(argv[++i]);
    else if (a.startsWith('--hosts=')) out.hosts = parseHosts(a.slice(8));
    else if (a === '--force') out.force = true;
    else if (a === '--quick') out.quick = true;
    else if (a === '--no-bootstrap') out.bootstrap = false;
    else if (a === '-h' || a === '--help') out.command = 'help';
    else throw new Error(`unknown argument ${a}`);
  }
  if (out.profile !== undefined && out.profile !== 'full') throw new Error('only the full profile exists');
  if (argv.includes('--profile') && out.profile === undefined) throw new Error('--profile requires a value of full');
  return out;
}


function readManifest(target) {
  const file = path.join(target, MANIFEST);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}
function writeManifest(target, kept = [], profile = 'full', bootstrapProfile = null, hostSkills = null) {
  const manifest = { name: pkg.name, version: pkg.version, installProtocol: installProtocol(), profile, bootstrapProfile, installedAt: new Date().toISOString(), files: hashTree(target) };
  const initialAgeSetup = readManifest(target)?.initialAgeSetup;
  if (initialAgeSetup !== undefined) manifest.initialAgeSetup = initialAgeSetup;
  if (hostSkills) manifest.hostSkills = hostSkills;
  if (kept.length) manifest.keptLocal = kept;
  writeFileSync(path.join(target, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}


function safePayloadTarget(target) {
  const inspect = (file, relative) => {
    if (isNegated(relative)) return;
    const stat = lstatSync(file, { throwIfNoEntry: false });
    if (!stat) return;
    if (stat.isSymbolicLink()) throw new Error('installer payload target contains a symlink/junction; resolve ownership before updating');
    if (stat.isDirectory()) for (const name of readdirSync(file)) inspect(path.join(file, name), `${relative}/${name}`);
  };
  if (lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('installer .claude target must not be a symlink/junction');
  for (const relative of [...PAYLOAD, MANIFEST]) inspect(path.join(target, relative), relative);
}

// Plan host changes before any payload mutation. Only exact installer-owned text is replaced.
// AGENTS.md is always planned; CLAUDE.md/DEVIN.md enter the plan only when the host opted in.
export function bootstrapPlan(repo, opts, manifest = null) {
  for (const name of [...HOST_BOOTSTRAP_NAMES, '.gitignore']) {
    const stat = lstatSync(path.join(repo, name), { throwIfNoEntry: false });
    if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw new Error(name + ': bootstrap target must be a regular owned file, not a symlink/junction');
  }
  const names = ['AGENTS.md', ...(opts.hosts ?? []).map((h) => HOST_BOOTSTRAP_FILES[h]).filter((n) => n && n !== 'AGENTS.md')];
  const entry = PROMPT_ENTRY;
  const bootstrap = BOOTSTRAP;
  const priorTemplate = path.join(repo, '.claude', 'init', 'AGENTS.md');
  const priorEntry = manifest?.files?.['init/AGENTS.md'] && existsSync(priorTemplate)
    && sha(priorTemplate) === manifest.files['init/AGENTS.md'] ? entryOf(readFileSync(priorTemplate, 'utf8').replace(/\r\n/g, '\n')) : null;
  return names.map(name => {
    const file = path.join(repo, name);
    if (!existsSync(file)) return { name, file, text: bootstrap, action: 'wrote' };
    const current = readFileSync(file, 'utf8');
    // The only managed block this installer knows is the one it writes. A file already carrying it is
    // left byte-identical; a file carrying any other starci:prompt-entry block is a conflict a person
    // resolves by hand - the installer never rewrites an entry it did not author.
    if (current.replace(/\r\n/g, '\n').includes(entry)) {
      return { name, file, text: current, action: 'unchanged' };
    }
    if (priorEntry && current.replace(/\r\n/g, '\n').includes(priorEntry)) {
      return {name, file, text: current.replace(/\r\n/g, '\n').replace(priorEntry, entry), action: 'updated'};
    }
    if (current.includes(ENTRY_MARKER)) {
      throw new Error(name + ': carries a StarCi entry this installer did not write; reconcile it by hand or pass --no-bootstrap');
    }
    return { name, file, text: current + (current.endsWith('\n') ? '\n' : '\n\n') + entry + '\n', action: 'updated' };
  });
}
function writeBootstraps(repo, log, plan) {
  for (const { name, file, text, action } of plan) {
    if (!existsSync(file) || readFileSync(file, 'utf8') !== text) writeFileSync(file, text);
    log(action + ' ' + name + ' (preserved custom instructions)');
  }
  const ignore = path.join(repo, '.gitignore');
  const lines = existsSync(ignore) ? readFileSync(ignore, 'utf8').split(/\r?\n/) : [];
  const missing = HOST_IGNORES.filter((entry) => !lines.some((l) => l.trim() === entry || l.trim() === '/' + entry));
  if (missing.length) {
    appendFileSync(ignore, `${lines.length && lines.at(-1) !== '' ? '\n' : ''}# StarCi: runtime state, owner config and credentials are local to this checkout\n${missing.join('\n')}\n`);
    for (const entry of missing) log(`added ${entry} to .gitignore`);
  }
}

/**
 * The only manifest marker this installer accepts: install-protocol@1 naming the engine schema this
 * package ships. A tree installed by anything else is not upgraded in place - it is cleaned by hand
 * and `init` runs fresh. A malformed marker is refused, never guessed.
 */
function checkInstalledProtocol(manifest) {
  const marker = manifest?.installProtocol;
  const object = marker && typeof marker === 'object' && !Array.isArray(marker);
  if (!object || marker.schema !== INSTALL_PROTOCOL_SCHEMA || engineRank(marker.engine) === null) {
    throw new Error(`${MANIFEST} does not record this installer's protocol; remove .claude by hand and run starci runtime install - older trees are cleaned manually, never upgraded in place`);
  }
  const installed = engineRank(marker.engine), current = engineRank(requireEngineSchema());
  if (installed > current) throw new Error(`installed workflow protocol ${marker.engine} is newer than supported ${requireEngineSchema()}`);
  if (installed < current) throw new Error(`installed workflow protocol ${marker.engine} predates ${requireEngineSchema()}; remove .claude by hand and run starci runtime install - older trees are cleaned manually, never upgraded in place`);
}

// Authored documentation roots are never cleanup targets: notes an earlier payload installed stay for
// the operator who read them, whatever the current payload ships.
const PRESERVED_ROOTS = new Set(['docs', 'sites']);
// The manifest is the whole ownership record. A file an earlier payload of this same protocol
// installed but the current payload no longer ships is stale: it is removed only while still
// byte-identical to what was written. Anything a person changed is preserved and reported instead.
function stalePlan(target, manifest) {
  const current = new Set(payloadFiles(packageRoot));
  const remove = [], preserved = [];
  for (const [relative, originalHash] of Object.entries(manifest?.files ?? {})) {
    if (typeof relative !== 'string' || relative.includes('\\') || relative.includes(':') || path.isAbsolute(relative) || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('invalid installed manifest path; refusing cleanup before writes');
    // A prior payload claim cannot authorize reading or deleting currently excluded local custody.
    if (PRESERVED_ROOTS.has(relative.split('/')[0]) || INSTALLED_IGNORES.includes('/' + relative) || isNegated(relative)) { preserved.push(relative); continue; }
    if (current.has(relative)) continue;
    if (relative.split('/').includes('.git')) { preserved.push(relative); continue; }
    let cursor = target, missing = false;
    for (const part of relative.split('/')) {
      cursor = path.join(cursor, part);
      const stat = lstatSync(cursor, { throwIfNoEntry: false });
      if (!stat) { missing = true; break; }
      if (stat.isSymbolicLink()) throw new Error('stale manifest path uses a symlink/junction; refusing cleanup before writes');
    }
    if (missing) continue;
    if (!statSync(cursor).isFile()) throw new Error('stale manifest entry must name an owned file, not a directory');
    if (manifest?.keptLocal?.includes(relative) || sha(cursor, relative) !== originalHash) preserved.push(relative);
    else remove.push({ relative, file: cursor, hash: originalHash });
  }
  return { remove, preserved: [...new Set(preserved)] };
}
function removeStaleFiles(target, plan) {
  const removed = [], preserved = [...plan.preserved];
  for (const item of plan.remove) {
    let cursor = target;
    for (const part of item.relative.split('/')) {
      cursor = path.join(cursor, part);
      if (lstatSync(cursor, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('stale target changed to a symlink/junction after planning; stopped cleanup');
    }
    const stat = lstatSync(item.file, { throwIfNoEntry: false });
    // Payload copy may already have replaced an unshipped nested file.
    if (stat) {
      if (stat.isSymbolicLink() || !stat.isFile() || sha(item.file, item.relative) !== item.hash) { preserved.push(item.relative); continue; }
      rmSync(item.file);
    }
    removed.push(item.relative);
    let directory = path.dirname(item.file);
    while (directory !== target && path.relative(target, directory) && !path.relative(target, directory).startsWith('..')) {
      try { rmdirSync(directory); } catch { break; }
      directory = path.dirname(directory);
    }
  }
  return { removedStale: removed, preservedStale: [...new Set(preserved)] };
}

function ensureInstalledGitignore(target) {
  const ignore = path.join(target, '.gitignore');
  const lines = existsSync(ignore) ? readFileSync(ignore, 'utf8').split(/\r?\n/) : [];
  const missing = INSTALLED_IGNORES.filter((entry) => !lines.includes(entry));
  if (!missing.length) return;
  appendFileSync(ignore, `${lines.length && lines.at(-1) !== '' ? '\n' : ''}${missing.join('\n')}\n`);
}

// The seeded owner config: `config.example.yaml` ships with the payload; the installer copies it
// verbatim (comments included) to the untracked `config.yaml` a host edits per project. Seeding is
// copy-if-absent only — an existing owner config is never rewritten by init or update.
function seedConfig(target, log) {
  const example = path.join(target, 'config.example.yaml');
  const file = path.join(target, 'config.yaml');
  if (!existsSync(example) || existsSync(file)) return;
  try {
    writeFileSync(file, readFileSync(example), { flag: 'wx' });
    log('seeded .claude/config.yaml from config.example.yaml (untracked owner config; keep it out of git)');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

export function init(opts, log = console.log) {
  const repo = path.resolve(opts.dir);
  const target = path.join(repo, '.claude');
  if (!existsSync(repo)) throw new Error(`${repo} does not exist`);
  safePayloadTarget(target);
  const manifest = readManifest(target);
  if (manifest) return update({ ...opts, dir: repo }, log);
  const profile = selectedProfile(opts);
  const hostPlan = opts.bootstrap ? bootstrapPlan(repo, opts) : null;
  const stale = stalePlan(target, manifest);
  const entries = entrySkillsPlan(repo, manifest);
  if (existsSync(target) && readdirSync(target).length && !manifest && !opts.force) {
    throw new Error(`${target} exists and was not installed by ${pkg.name}; move it away or pass --force to replace the runtime paths inside it`);
  }
  mkdirSync(target, { recursive: true });
  copyPayload(target);
  seedConfig(target, log);
  const hostSkills = applyEntrySkillsPlan(entries, log);
  const cleaned = removeStaleFiles(target, stale);
  ensureInstalledGitignore(target);
  const written = writeManifest(target, [], profile, hostPlan ? profile : manifest?.bootstrapProfile ?? null, hostSkills);
  log(`installed ${pkg.name}@${pkg.version} into ${target} (${Object.keys(written.files).length} files)`);
  if (hostPlan) writeBootstraps(repo, log, hostPlan);
  else log(`host files unchanged; add these to .gitignore yourself: ${HOST_IGNORES.join('  ')}`);
  log('installed profile: ' + profile + (hostPlan ? '; bootstrap updated' : '; host bootstrap unchanged'));
  if (cleaned.removedStale.length) log(`removed ${cleaned.removedStale.length} unchanged unshipped file(s); recover from the prior package/Git revision`);
  for (const relative of cleaned.preservedStale) log(`preserved unowned/changed ${relative}; review ownership before any manual cleanup`);
  return { ...written, ...cleaned };
}

export function update(opts, log = console.log) {
  const target = path.resolve(opts.dir, '.claude');
  safePayloadTarget(target);
  const manifest = readManifest(target);
  if (!manifest) throw new Error(`${target} has no ${MANIFEST}; run starci runtime install first`);
  checkInstalledProtocol(manifest);
  const profile = selectedProfile(opts);
  const hostPlan = opts.bootstrap !== false ? bootstrapPlan(opts.dir, opts, manifest) : null;
  const stale = stalePlan(target, manifest);
  const entries = entrySkillsPlan(opts.dir, manifest);
  if (!opts.force && (Object.hasOwn(manifest.files ?? {}, EXAMPLE_CATALOG_FILE)
    || existsSync(path.join(target, EXAMPLE_CATALOG_FILE)))) payloadFiles(target);
  const before = hashTree(target, manifest, opts.force);
  const locallyChanged = Object.entries(before).filter(([rel, h]) => manifest.files[rel] && manifest.files[rel] !== h).map(([rel]) => rel);
  const locallyAdded = Object.keys(before).filter((rel) => !manifest.files[rel]);
  const stillKept = (manifest.keptLocal ?? []).filter(rel => Object.hasOwn(before, rel));
  const saved = Object.fromEntries([...new Set([...locallyChanged, ...locallyAdded, ...stillKept])].map((rel) => [rel, readFileSync(path.join(target, rel))]));
  copyPayload(target);
  seedConfig(target, log);
  const hostSkills = applyEntrySkillsPlan(entries, log);
  const currentFiles = new Set(payloadFiles(packageRoot));
  const kept = [];
  for (const [rel, bytes] of Object.entries(saved)) {
    if (opts.force && currentFiles.has(rel)) continue;
    const file = path.join(target, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, bytes);
    kept.push(rel);
  }
  const cleaned = removeStaleFiles(target, stale);
  ensureInstalledGitignore(target);
  const written = writeManifest(target, kept, profile, hostPlan ? profile : manifest.bootstrapProfile ?? null, hostSkills);
  log(`updated ${manifest.name}@${manifest.version} -> ${pkg.name}@${pkg.version} in ${target}`);
  for (const rel of kept) log(`kept ${rel} (changed locally; pass --force to take the package version)`);
  if (opts.force) log(`replaced ${Object.keys(saved).filter(rel => currentFiles.has(rel)).length} local current-payload file(s); unowned and locally changed files are preserved`);
  if (hostPlan) writeBootstraps(opts.dir, log, hostPlan);
  else log(`host files unchanged; add these to .gitignore yourself: ${HOST_IGNORES.join('  ')}`);
  if (cleaned.removedStale.length) log(`removed ${cleaned.removedStale.length} unchanged unshipped file(s); recover from the prior package/Git revision`);
  for (const relative of cleaned.preservedStale) log(`preserved unowned/changed ${relative}; review ownership before any manual cleanup`);
  return { ...written, ...cleaned };
}

/** Diagnose only installer-owned source, discovery custody and local runtime capabilities. */
export function doctor(opts, log = console.log) {
  const target = path.resolve(opts.dir, '.claude');
  return doctorInstallation({
    target, repo: path.resolve(opts.dir), manifest: readManifest(target), packageManifest: pkg,
    expectedFiles: hashTree(packageRoot), checkProtocol: checkInstalledProtocol,
    planEntries: entrySkillsPlan, excluded: isNegated, quick: opts.quick,
  }, log);
}

const HELP = `${pkg.name} ${pkg.version}

  starci runtime install [--cwd <repo>] [--force] [--no-bootstrap] [--hosts claude,devin]
  starci runtime update  [--cwd <repo>] [--force] [--hosts claude,devin]
  starci runtime doctor  [--cwd <repo>] [--quick]
  starci runtime version

install copies source into <repo>/.claude, records its custody and installs declared runtime dependencies.
        Seeds an untracked .claude/config.yaml from config.example.yaml; installs the one starci
        entry into .agents/skills/ and an existing .devin/skills/ root with exact file custody; writes the managed StarCi entry into AGENTS.md — CLAUDE.md/DEVIN.md copies only when
        named by --hosts; and adds runtime state, owner config and secret.env to the host .gitignore while
        preserving custom instructions. Refuses a .claude it did not install unless --force;
        --no-bootstrap keeps host files unchanged (the gitignore lines are printed instead).
        An eligible original init reserves its initial AGE setup before native generation; an
        existing explicit identity is reused, and ambiguous or prior unknown custody is held.
update  replaces current runtime paths; locally changed current files are kept unless --force.
        The runtime reads the installed source directly; no build step runs before recording the
        new version. Manifest-owned files the payload no longer ships are removed when unchanged;
        changed or unowned files are preserved. Local config, credentials and excluded custody are
        never cleanup targets. An install recorded under any other protocol is not upgraded in
        place: remove .claude by hand and run starci runtime install.
doctor  verifies installed payload and public-entry custody, parses shipped YAML contracts,
        and checks physical runtime dependencies, the dispatcher and Node's SQLite capability.
        --quick checks install integrity only; host, provider and product readiness use their owning checks.
entry   one explicit StarCi skill plus one AGENTS.md prompt-entry. Only an exact prior installed
        entry block may be refreshed; an unknown StarCi block stops before writes. Reconcile it by
        hand or pass --no-bootstrap. Existing ledgers are retained.
`;

function safeDependencyTarget(target) {
  for (const name of ['', ...Object.keys(pkg.dependencies ?? {})]) {
    let cursor = target;
    for (const part of ['node_modules', ...name.split('/').filter(Boolean)]) {
      cursor = path.join(cursor, part);
      const stat = lstatSync(cursor, {throwIfNoEntry: false});
      if (stat && (isLinkLike(cursor, {stat}) || !stat.isDirectory())) throw new Error('runtime dependency target is redirected or not a directory');
    }
  }
}

/**
 * Run the installed-package lifecycle; exported init/update remain filesystem projection helpers.
 * Dependency installation runs only after a successful projection, in its own physical target.
 * @param {string[]} argv Installer command and supported arguments.
 * @param {object} deps Owned npm/initial-AGE ports, environment and diagnostic sinks for focused fixtures.
 * @returns {number} Zero only when the selected lifecycle or diagnostic completes successfully.
 */
export function main(argv = process.argv.slice(2), deps = {}) {
  const log = deps.log ?? console.log;
  const error = deps.error ?? console.error;
  try {
    const opts = parseArgs(argv);
    if (opts.command === 'init' || opts.command === 'update') {
      const project = () => {
        const target = path.resolve(opts.dir, '.claude');
        safeDependencyTarget(target);
        if (opts.command === 'init') init(opts, log);
        else update(opts, log);
        const projectedNode = lstatSync(target);
        const installed = JSON.parse(readFileSync(path.join(target, 'package.json'), 'utf8'));
        const entries = value => Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b));
        if (installed.name !== pkg.name || installed.version !== pkg.version
          || JSON.stringify(entries(installed.dependencies)) !== JSON.stringify(entries(pkg.dependencies))) {
          throw new Error('installed package identity or runtime dependencies differ from this installer; reconcile local edits before installing dependencies');
        }
        if (Object.keys(installed.dependencies ?? {}).length) {
          safeDependencyTarget(target);
          const result = (deps.runNpm ?? runNpm)(['install', '--prefix', target, '--omit=dev', '--no-save', '--package-lock=false', '--no-audit', '--no-fund'],
            {cwd: target, env: deps.env ?? process.env, timeout: 900_000});
          if (result.stdout?.trim()) log(result.stdout.trim());
          if (result.stderr?.trim()) error(result.stderr.trim());
          if (result.error || result.signal || result.status !== 0) {
            throw new Error('runtime dependency installation failed (' + (result.status ?? result.signal ?? result.error?.code ?? 'incomplete') + '): ' + (result.error?.message ?? 'see npm diagnostics'));
          }
          log('runtime dependency install completed in ' + target);
        }
        return {status: 0, targetNode: projectedNode};
      };
      if (opts.command === 'update') return project().status;
      const setup = runInitialAgeInstall({repo: path.resolve(opts.dir), force: opts.force, project},
        {...(deps.initialAge ?? {}), env: deps.env ?? process.env});
      log('initial age setup: ' + JSON.stringify(setup));
      // The init identity needs an accepted age-keygen (scripts/api/sops/selected-age-versions.mjs); the install never skips key generation.
      if (AGE_TOOL_REASONS[setup.toolReason]) error(pkg.name + ': ' + AGE_TOOL_REASONS[setup.toolReason] + '; init needs age-keygen ' + selectedAgeVersions().join(' or ') + ' on PATH (docs/installation.md, Prerequisites). Install it, then run starci runtime install again.');
      return setup.ok ? 0 : 1;
    }
    if (opts.command === 'doctor') return doctor(opts, log) ? 1 : 0;
    log(opts.command === 'version' ? pkg.version : HELP);
    return 0;
  } catch (err) {
    error(pkg.name + ': ' + err.message);
    return 1;
  }
}

if (isMain(import.meta.url)) process.exitCode = main();
