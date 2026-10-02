#!/usr/bin/env node
// hfs - the HFS command line of a StarCi app: one repository, `<app>/`, with one package.json, lockfile and node_modules at its root
// and two sides, be/ and fe/, declared by the one hfs.json of kind app. Every verb runs at the app root.
//   hfs check   [--repo <dir>] [--json] [--fast] [--base <ref>]
//                                            every tracked path has a slot; required files exist; nothing forbidden or
//                                            tracked-that-must-be-ignored; pins match; every managed file equals its render
//                                            (sync/managed.mjs, the .gitignore block and sonar-project.properties included); no empty or ghost
//                                            directory, no untracked entry outside an ignored slot; plaintext secrets, the .starcistacks shape, CI
//                                            and pre-push canon steps, dependency version skew, the contract snapshot and the test, wire and i18n
//                                            trees; prettier over every tracked file through the repository's own install (sync/format.mjs; not under
//                                            --fast, and a repository without prettier is a refusal); soft-size backlog (report only); then the whole
//                                            architecture machine (tiers, owners, clones, dead exports, module registration, the
//                                            front-end and back-end source rules), each violation a finding with its why.
//                                            --fast: only what changed since the merge-base with origin/main (else main; --base
//                                            overrides it); the machine
//                                            runs on those owners without clones and dead exports. No merge-base is a refusal
//                                            (exit 2), never a silent full pass. Exit 1 on any error-level finding. The root checks run once and
//                                            the side checks and the machine once per side, the side folder as their root; every path is app-relative.
//   hfs lint    [--repo <dir>] [--changed <file>...] [--workspace <dir>] [--fix] [--format text|json] [--sonar <file>]
//                                            the ONE lint entry (npm run lint): ESLint per side with that side's canon config (per-file rules and
//                                            the project-graph rules), this check's findings, and stylelint over the fe side, as one starci/lint@1
//                                            report; --sonar writes the one Sonar import file. Exit 0 clean, 1 findings, 2 a tool could not run (lint/run.mjs).
//                                            --workspace <dir> (from the current directory) scopes the same lint to one fe workspace: the
//                                            `lint` script of fe/apps/<app> and fe/packages/<pkg>, run by the turbo lint task.
//   hfs scaffold app <name> [--into <dir>]  a new app <dir>/<name>/: the root (hfs.json, package.json, managed files, .starciwork) and the
//                                            be/ and fe/ skeletons (scaffold/app.mjs). Refuses an existing directory.
//   hfs explain <path> [--repo <dir>] [--json]   which slot owns the path, its tier, allowed imports, required tests.
//   hfs emit-contracts [--repo <dir>]      write be/contracts/<app>/schema.graphql of every api app that serves GraphQL (emit/contracts.mjs):
//                                            printSchema(lexicographicSortSchema) of the resolvers the app root composes; no env, no database, no network.
//   hfs sync (--check | --write) [--root <dir>]  the managed files of the root (scripts, husky, CI, .gitignore block, sonar, prettier) and
//                                            of each side (tsconfig, eslint, jest, stylelint); sync/cli.mjs
//   hfs work-hygiene                              the pre-commit guard: staged .starciwork and .starcistacks paths, and the secrets guard over every staged file (read from the index); sync/cli.mjs
//   hfs new service <dir> <name> [--inject <Decorator>=<module>:<Type> | <Class>=<module>]... [--repo <dir>]
//                                            a back-end `<name>.service.ts` and its `<name>.service.spec.ts` skeleton (scaffold/service.mjs; <dir> is
//                                            relative to be/): the spec is built
//                                            with Test.createTestingModule, one provider per constructor dependency (kit doubles from @starci/jest-preset),
//                                            one placeholder it per public method. Never overwrites a file.
//   hfs new image [--repo <dir>]                  the Dockerfile of every declared app that has none, from the image canon (scaffold/image.mjs); never overwrites
//   hfs new spec <file>.service.ts [--repo <dir>]
//                                            the spec skeleton of an existing service, read from its constructor with the repository's TypeScript
//   hfs add <job|reactor|queue|projection> <name> [--event <event> --from <service> --service <Class>=<module>] [--connection <name>] [--repo <dir>]
//                                            exactly that kind's file tree, generated FROM the files: tree of its pattern topic (knowledge/patterns/be) with the
//                                            one template body of each entry (templates/be/patterns), plus the platform capabilities it needs when they are missing;
//                                            it registers the patterns and the trigger kind in hfs.json (sides.be.patterns, sides.be.kinds). Never overwrites a file (scaffold/add.mjs).
// Every finding names a why code and carries its Vietnamese text. check, lint and explain read the app, never write to it. Exit codes:
// 0 clean, 1 error findings, 2 a refusal or bad usage.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from '../runtime/scripts/lib/is-main.mjs';
import { checkRepository, explainPath, trackedFiles } from '../runtime/scripts/hfs/check.mjs';
import { HFS_DECLARATION_FILE, HfsSlotsError, loadSlotManifest, readRepoDeclaration } from '../runtime/scripts/hfs/slots.mjs';
import { formatFindings } from '../sync/format.mjs';
import { main as syncMain } from '../sync/cli.mjs';
import { SyncError, loadPresets } from '../sync/index.mjs';
import { managedFindings } from '../sync/managed.mjs';
import { emitContracts } from '../emit/contracts.mjs';
import { ScaffoldError, newService, newSpec } from '../scaffold/service.mjs';
import { addKind } from '../scaffold/add.mjs';
import { scaffoldApp } from '../scaffold/app.mjs';
import { newImages } from '../scaffold/image.mjs';
import { contractEmitFindings } from '../runtime/scripts/hfs/rules/contract.mjs';
import { lintRepository, parseLintArgs, printLintText } from '../lint/run.mjs';
import { writeReport } from '../report/sonar.mjs';

const USAGE = `hfs check [--repo <dir>] [--json] [--fast] [--base <ref>]
hfs lint [--repo <dir>] [--changed <file>...] [--workspace <dir>] [--fix] [--format text|json] [--sonar <file>]
hfs scaffold app <name> [--into <dir>]
hfs emit-contracts [--repo <dir>]
hfs explain <path> [--repo <dir>] [--json]
hfs sync (--check | --write) [--root <dir>]
hfs work-hygiene
hfs new service <dir> <name> [--inject <Decorator>=<module>:<Type> | <Class>=<module>]... [--repo <dir>]
hfs new spec <file>.service.ts [--repo <dir>]
hfs add <job|reactor|queue|projection> <name> [--event <event> --from <service> --service <Class>=<module>] [--connection <name>] [--repo <dir>]
hfs new image [--repo <dir>]
`;
const PER_CODE_LIMIT = 25;
const VALUE_FLAGS = new Set(['--repo', '--base', '--inject', '--into', '--event', '--from', '--service', '--connection']);
/** Flags that may repeat: their values are collected in order. */
const LIST_FLAGS = new Set(['--inject']);
const BOOL_FLAGS = new Set(['--json', '--fast']);

function parse(argv) {
  const opts = { positional: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (VALUE_FLAGS.has(arg)) {
      if (argv[i + 1] === undefined) throw new Error(`${arg} needs a value`);
      opts[arg.slice(2)] = LIST_FLAGS.has(arg) ? [...(opts[arg.slice(2)] ?? []), argv[i + 1]] : argv[i + 1];
      i += 1;
    }
    else if (BOOL_FLAGS.has(arg)) opts[arg.slice(2)] = true;
    else if (arg.startsWith('--')) throw new Error(`unknown flag ${arg}`);
    else opts.positional.push(arg);
  }
  return opts;
}

function printCheck(result, out) {
  const { counts } = result;
  out(`hfs check${result.fast ? ' --fast' : ''} ${result.repoRoot} (profile ${result.profile ?? 'unknown'}, manifest ${result.manifest}, ${result.tracked} tracked paths)\n`);
  if (result.fast) out(`  ${result.fast.changed} path${result.fast.changed === 1 ? '' : 's'} changed since ${result.fast.base.slice(0, 12)}\n`);
  out(`  architecture machine: ${result.machine.status === 'ran' ? `ran over ${result.machine.files} source files${result.machine.paths ? ` (owners ${result.machine.paths.join(', ')})` : ''}` : `skipped, ${result.machine.reason}`}\n`);
  if (result.contracts) out(`  contract snapshots: ${result.contracts.status === 'checked' ? `emitted and compared, ${result.contracts.apps.map((a) => `${a.app}/${a.artifact} ${a.status}`).join(', ') || 'no api app'}` : `skipped, ${result.contracts.reason}`}
`);
  const byCode = new Map();
  for (const f of result.findings) byCode.set(f.code, [...(byCode.get(f.code) ?? []), f]);
  for (const [code, list] of byCode) {
    const first = list[0];
    out(`\n[${first.level.toUpperCase()}] ${code} x${list.length}: ${first.titleVi}\n  ${first.whyVi}\n  -> ${first.nextStepVi}\n`);
    for (const f of list.slice(0, PER_CODE_LIMIT)) out(`  - ${f.message}\n`);
    if (list.length > PER_CODE_LIMIT) out(`  ... and ${list.length - PER_CODE_LIMIT} more (use --json for all)\n`);
  }
  out(`\n${counts.error} error finding${counts.error === 1 ? '' : 's'}, ${counts.info} report-only\n`);
}

function printExplain(e, out) {
  out(`${e.path}\n`);
  if (e.status === 'no-slot') {
    out(`  no slot owns this path (${e.code}): ${e.titleVi}\n  ${e.whyVi}\n`);
    if (e.nearest) out(`  nearest slot ${e.nearest.slot}, pattern ${e.nearest.pattern}; matched ${e.nearest.matchedPrefix || '.'}, then expected ${e.nearest.expectedNext ?? 'nothing'}\n`);
    return;
  }
  if (e.status === 'ambiguous') { out(`  owned equally by ${e.candidates.join(', ')} (${e.code}): ${e.titleVi}\n`); return; }
  out(`  slot       ${e.slot}  (${e.pattern})\n  presence   ${e.presence}, ${e.tracking}\n  tier       ${e.tier}${e.owner ? `  owner ${e.owner.root} (${e.owner.slot})` : ''}\n`);
  out(`  imports    ${e.allowedImports ? `may import ${e.allowedImports.join(', ')}; ${e.importRule}` : (e.importRule ?? 'not applicable')}\n`);
  out(`  tests      ${e.tests}: ${e.testsMeaning}\n`);
  if (e.requiredFiles.length) out(`  requires   ${e.requiredFiles.join(', ')}\n`);
  if (e.goesTo) out(`  belongs at ${e.goesTo}\n`);
  if (e.rules) out(`  rules      ${e.rules.join(', ')}\n`);
  if (e.code) out(`  ${e.code}: ${e.titleVi}\n  ${e.whyVi}\n`);
}

/**
 * The app pass: slots, managed files, formatter, contract snapshots and the architecture machine's check surface, root and sides.
 * `only` limits the formatter to those (app-relative) files.
 */
async function runCheck({ repoRoot, fast = false, base, only, presets, prettier }) {
  const tracked = trackedFiles(repoRoot);
  // Managed files of the root and both sides, the .gitignore block and sonar against their render (R04, R05, R11, ...), and prettier
  // through the app's own install (R19, never under --fast).
  const extraFindings = [...await managedFindings({ repoRoot, tracked, presets }), ...(fast ? [] : await formatFindings({ repoRoot, files: only ?? tracked, prettier }))];
  // R23 against the be side itself (full pass only): the committed snapshots equal what `emit-contracts` writes now.
  let contracts = null;
  let be = null;
  try { be = readRepoDeclaration(loadSlotManifest(), repoRoot).sides?.be ?? null; } catch { /* checkRepository reports the unreadable declaration */ }
  if (be) {
    if (fast) contracts = { status: 'skipped', reason: '--fast does not emit the apps' };
    else {
      const files = tracked.filter((file) => file.startsWith('be/')).map((file) => file.slice('be/'.length));
      const emitted = contractEmitFindings({ repoRoot: path.join(repoRoot, 'be'), files, repo: be, emit: emitContracts });
      extraFindings.push(...emitted.findings.map((finding) => ({ ...finding, side: 'be', path: `be/${finding.path}` })));
      contracts = { status: 'checked', apps: emitted.apps };
    }
  }
  const result = checkRepository({ repoRoot, fast, base, extraFindings });
  if (contracts) result.contracts = contracts;
  return result;
}

/** The nearest folder at or above `dir` that holds hfs.json (the app root of a workspace), or `dir` itself when none does (the lint then refuses it). */
export function appRootAbove(dir) {
  for (let at = dir; ; at = path.dirname(at)) {
    if (fs.existsSync(path.join(at, HFS_DECLARATION_FILE))) return at;
    if (path.dirname(at) === at) return dir;
  }
}

/** `hfs lint`: ESLint per side, the app checks and stylelint over the fe side as one report; see lint/run.mjs. */
async function lintMain(argv, { stdout, presets, prettier }) {
  const opts = parseLintArgs(argv);
  // --workspace names a folder from the current directory (`hfs lint --workspace .` is the lint script of an fe workspace); the app
  // root is then the nearest folder above it that holds hfs.json, and the workspace is passed on app-relative.
  const workspaceDir = opts.workspace === undefined ? null : path.resolve(opts.workspace);
  const repoRoot = path.resolve(opts.repo ?? (workspaceDir ? appRootAbove(workspaceDir) : process.cwd()));
  if (workspaceDir) opts.workspace = path.relative(repoRoot, workspaceDir).split(path.sep).join('/');
  const { report, sonar, exit } = await lintRepository({
    repoRoot, opts, trackedFiles,
    hfsCheck: (root) => runCheck({ repoRoot: root, only: opts.changed ?? undefined, presets, prettier }),
  });
  if (opts.sonar !== undefined) writeReport(path.resolve(opts.sonar), sonar);
  if (opts.format === 'json') stdout(`${JSON.stringify(report, null, 2)}
`); else printLintText(report, stdout);
  return exit;
}

/**
 * The jest preset a new app renders its Sonar exclusions from: the one installed beside this @starci/hfs (`npx -p @starci/hfs -p
 * @starci/jest-preset hfs scaffold app <name>`, or an install that holds both). None is a refusal, never a render without it.
 */
async function scaffoldPresets() {
  try { return await loadPresets(path.dirname(fileURLToPath(import.meta.url))); } catch (error) {
    throw new SyncError('HFS_SYNC_PRESET_MISSING', `${error.message.replace(/^[A-Z_]+: /, '')}; run hfs scaffold with @starci/jest-preset installed beside @starci/hfs (npx -p @starci/hfs -p @starci/jest-preset hfs scaffold app <name>)`);
  }
}

/** `presets` and `prettier` are test seams: the Sonar exclusions sync would load from the repository's installed preset, and the repository's own prettier. */
export async function main(argv, { stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s), presets, prettier } = {}) {
  const [verb, ...rest] = argv;
  if (!['check', 'lint', 'scaffold', 'explain', 'sync', 'work-hygiene', 'emit-contracts', 'new', 'add'].includes(verb)) { stderr(USAGE); return 2; }
  try {
    if (verb === 'sync' || verb === 'work-hygiene') return await syncMain(argv);
    if (verb === 'lint') return await lintMain(rest, { stdout, presets, prettier });
    const opts = parse(rest);
    const repoRoot = path.resolve(opts.repo ?? process.cwd());
    if (verb === 'check') {
      if (opts.positional.length) throw new Error('hfs check takes no path');
      if (opts.base !== undefined && opts.fast !== true) throw new Error('--base names the ref --fast compares with; it needs --fast');
      const result = await runCheck({ repoRoot, fast: opts.fast === true, base: opts.base, presets, prettier });
      if (opts.json) stdout(`${JSON.stringify(result, null, 2)}\n`); else printCheck(result, stdout);
      return result.ok ? 0 : 1;
    }
    if (verb === 'emit-contracts') {
      if (opts.positional.length) throw new Error('hfs emit-contracts takes no path');
      const be = readRepoDeclaration(loadSlotManifest(), repoRoot).sides?.be;
      if (!be) throw new Error('hfs emit-contracts runs at the app root (the folder of hfs.json)');
      const { written, skipped, standIns } = emitContracts({ repoRoot: path.join(repoRoot, 'be'), declaration: be });
      for (const file of written) stdout(`wrote be/${file}
`);
      stdout(`hfs emit-contracts: ${written.length} written${skipped.length ? `, ${skipped.join(', ')} serve no GraphQL` : ''}
`);
      for (const [app, lines] of Object.entries(standIns)) {
        stdout(`${app}: ${lines.length} dependenc${lines.length === 1 ? 'y' : 'ies'} of the resolvers could not load here and stood in (no GraphQL type is affected):\n`);
        for (const line of lines) stdout(`  ${line}\n`);
      }
      return 0;
    }
    if (verb === 'new') {
      const [kind, ...args] = opts.positional;
      let written;
      if (kind === 'service' && args.length === 2) written = newService({ repoRoot, dir: args[0], name: args[1], inject: opts.inject ?? [] });
      else if (kind === 'spec' && args.length === 1 && opts.inject === undefined) written = newSpec({ repoRoot, file: args[0] });
      else if (kind === 'image' && args.length === 0 && opts.inject === undefined) written = newImages({ repoRoot });
      else throw new Error('hfs new takes `service <dir> <name> [--inject ...]`, `spec <file>.service.ts` or `image`');
      for (const file of written) stdout(`created ${file}
`);
      return 0;
    }
    if (verb === 'add') {
      const [noun, name, ...extra] = opts.positional;
      if (!noun || !name || extra.length) throw new Error('hfs add takes `<noun> <name>` and the options of the noun');
      const { created, registered } = addKind({ repoRoot, noun, name, options: { event: opts.event, from: opts.from, service: opts.service, connection: opts.connection } });
      for (const file of created) stdout(`created ${file}
`);
      stdout(`hfs add ${noun}: registered patterns ${registered.patterns.join(', ')}${registered.kinds.length ? `; kinds ${registered.kinds.join(', ')}` : ''}
`);
      return 0;
    }
    if (verb === 'scaffold') {
      const [kind, name, ...extra] = opts.positional;
      if (kind !== 'app' || !name || extra.length || opts.repo !== undefined) throw new Error('hfs scaffold takes `app <name> [--into <dir>]`');
      const { root: created, files } = scaffoldApp({ name, into: path.resolve(opts.into ?? process.cwd()), presets: presets ?? await scaffoldPresets() });
      stdout(`hfs scaffold app: created ${created} (${files.length} files); next: npm ci, then npm run lint\n`);
      return 0;
    }
    if (opts.positional.length !== 1) throw new Error('hfs explain takes exactly one path');
    const explained = explainPath({ repoRoot, input: opts.positional[0] });
    if (opts.json) stdout(`${JSON.stringify(explained, null, 2)}\n`); else printExplain(explained, stdout);
    return explained.status === 'no-slot' || explained.status === 'ambiguous' ? 1 : 0;
  } catch (error) {
    stderr(error instanceof HfsSlotsError || error instanceof SyncError ? `${error.message}\n` : error instanceof ScaffoldError ? `${error.code}: ${error.message}\n` : `hfs: ${error.message}\n${USAGE}`);
    return 2;
  }
}

// Run when this file is the entry point, compared by real path: through a node_modules junction or an npx shim argv[1] is
// the junction path while import.meta.url is the resolved one, and a plain comparison silently skipped main (hfs printed nothing).
if (isMain(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
