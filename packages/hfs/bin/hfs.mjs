#!/usr/bin/env node
// hfs - the HFS command line of a StarCi product repository.
//   hfs check   [--repo <dir>] [--json] [--fast] [--base <ref>] [--sonar <file>]
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
//                                            overrides it, and without --fast is the base of the size-growth check); the machine
//                                            runs on those owners without clones and dead exports. No merge-base is a refusal
//                                            (exit 2), never a silent full pass. Exit 1 on any error-level finding.
//                                            --sonar: also write the error findings as a Sonar Generic Issue Import file (report/sonar.mjs),
//                                            before the verdict, so a failing check still leaves the report Sonar imports.
//   hfs report <eslint|stylelint> <in> <out> [--repo <dir>]  convert a linter's json output into a Sonar Generic Issue Import file
//                                            (one converter for both linters; a finding on a file Sonar does not index is filed on the first
//                                            source file of sonar.sources, the real path in its message).
//   hfs init    [--repo <dir>] [--stdout]   write a starter hfs.json by detecting the profile and the apps.
//   hfs explain <path> [--repo <dir>] [--json]   which slot owns the path, its tier, allowed imports, required tests.
//   hfs emit-contracts [--repo <dir>]      write contracts/<app>/schema.graphql of every api app that serves GraphQL (emit/contracts.mjs):
//                                            printSchema(lexicographicSortSchema) of the resolvers the app root composes; no env, no database, no network.
//   hfs sync (--check | --write) [--root <dir>]  the generated files (husky, CI, .gitignore block, sonar, codecov); sync/cli.mjs
//   hfs work-hygiene                              the pre-commit guard for staged .starciwork and .starcistacks paths; sync/cli.mjs
// Every finding names a why code and carries its Vietnamese text. The command reads the repository, never writes to it
// (init writes hfs.json only, and only when none exists). Exit codes: 0 clean, 1 error findings, 2 a refusal or bad usage.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRepository, explainPath, initRepo, trackedFiles } from '../runtime/scripts/lib/hfs-check.mjs';
import { HfsSlotsError } from '../runtime/scripts/lib/hfs-slots.mjs';
import { formatFindings } from '../sync/format.mjs';
import { main as syncMain } from '../sync/cli.mjs';
import { SyncError } from '../sync/index.mjs';
import { managedFindings } from '../sync/managed.mjs';
import { emitContracts } from '../emit/contracts.mjs';
import { contractEmitFindings } from '../runtime/scripts/lib/hfs-rules/contract.mjs';
import { LINTER_KINDS, convertReportFile, sonarReport, sourceRootsOf, writeReport } from '../report/sonar.mjs';

const USAGE = `hfs check [--repo <dir>] [--json] [--fast] [--base <ref>] [--sonar <file>]
hfs report <eslint|stylelint> <in> <out> [--repo <dir>]
hfs init [--repo <dir>] [--stdout]
hfs emit-contracts [--repo <dir>]
hfs explain <path> [--repo <dir>] [--json]
hfs sync (--check | --write) [--root <dir>]
hfs work-hygiene
`;
const PER_CODE_LIMIT = 25;
const VALUE_FLAGS = new Set(['--repo', '--base', '--sonar']);
const BOOL_FLAGS = new Set(['--json', '--stdout', '--fast']);

function parse(argv) {
  const opts = { positional: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (VALUE_FLAGS.has(arg)) { opts[arg.slice(2)] = argv[i + 1]; i += 1; if (opts[arg.slice(2)] === undefined) throw new Error(`${arg} needs a value`); }
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

/** The check's error findings as the Sonar import file: findings outside `sonar.sources` are filed on the first source file. */
function writeSonarReport({ repoRoot, file, result }) {
  let properties = '';
  try { properties = fs.readFileSync(path.join(repoRoot, 'sonar-project.properties'), 'utf8'); } catch { /* no properties: every finding keeps its own path */ }
  writeReport(file, sonarReport(result.findings, { sourceRoots: sourceRootsOf(properties), tracked: trackedFiles(repoRoot) }));
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

/** `presets` and `prettier` are test seams: the coverage denominators sync would load from the repository's installed preset, and the repository's own prettier. */
export async function main(argv, { stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s), presets, prettier } = {}) {
  const [verb, ...rest] = argv;
  if (!['check', 'init', 'explain', 'sync', 'work-hygiene', 'report', 'emit-contracts'].includes(verb)) { stderr(USAGE); return 2; }
  try {
    if (verb === 'sync' || verb === 'work-hygiene') return await syncMain(argv);
    const opts = parse(rest);
    const repoRoot = path.resolve(opts.repo ?? process.cwd());
    if (verb === 'check') {
      if (opts.positional.length) throw new Error('hfs check takes no path');
      const tracked = trackedFiles(repoRoot);
      // Managed files, the .gitignore block and sonar against their render (R04, R05, R11, ...), and prettier through the repository's own install (R19, never under --fast).
      const extraFindings = [...await managedFindings({ repoRoot, tracked, presets }), ...(opts.fast === true ? [] : await formatFindings({ repoRoot, files: tracked, prettier }))];
      // R23 against the app itself (full pass only): the committed snapshots equal what `emit-contracts` writes now.
      let contracts = null;
      let declared = null;
      try { declared = JSON.parse(fs.readFileSync(path.join(repoRoot, 'hfs.json'), 'utf8')); } catch { /* checkRepository reports the unreadable declaration */ }
      if (declared?.profile === 'be') {
        if (opts.fast === true) contracts = { status: 'skipped', reason: '--fast does not emit the apps' };
        else {
          const emitted = contractEmitFindings({ repoRoot, files: tracked, repo: declared, emit: emitContracts });
          extraFindings.push(...emitted.findings);
          contracts = { status: 'checked', apps: emitted.apps };
        }
      }
      const result = checkRepository({ repoRoot, fast: opts.fast === true, base: opts.base, extraFindings });
      if (contracts) result.contracts = contracts;
      if (opts.sonar !== undefined) writeSonarReport({ repoRoot, file: path.resolve(opts.sonar), result });
      if (opts.json) stdout(`${JSON.stringify(result, null, 2)}\n`); else printCheck(result, stdout);
      return result.ok ? 0 : 1;
    }
    if (verb === 'report') {
      if (opts.positional.length !== 3 || !LINTER_KINDS.includes(opts.positional[0])) throw new Error(`hfs report takes a linter (${LINTER_KINDS.join(' or ')}), an input and an output file`);
      const [kind, input, output] = opts.positional;
      let properties = '';
      try { properties = fs.readFileSync(path.join(repoRoot, 'sonar-project.properties'), 'utf8'); } catch { /* no properties: every finding keeps its own path */ }
      const sourceRoots = sourceRootsOf(properties);
      const issues = convertReportFile({ kind, input: path.resolve(input), output: path.resolve(output), root: repoRoot, sourceRoots, tracked: sourceRoots.length ? trackedFiles(repoRoot) : [] });
      stdout(`hfs report ${kind}: ${issues} issue${issues === 1 ? '' : 's'} written to ${output}\n`);
      return 0;
    }
    if (verb === 'emit-contracts') {
      if (opts.positional.length) throw new Error('hfs emit-contracts takes no path');
      const declaration = JSON.parse(fs.readFileSync(path.join(repoRoot, 'hfs.json'), 'utf8'));
      const { written, skipped, standIns } = emitContracts({ repoRoot, declaration });
      for (const file of written) stdout(`wrote ${file}
`);
      stdout(`hfs emit-contracts: ${written.length} written${skipped.length ? `, ${skipped.join(', ')} serve no GraphQL` : ''}
`);
      for (const [app, lines] of Object.entries(standIns)) {
        stdout(`${app}: ${lines.length} dependenc${lines.length === 1 ? 'y' : 'ies'} of the resolvers could not load here and stood in (no GraphQL type is affected):\n`);
        for (const line of lines) stdout(`  ${line}\n`);
      }
      return 0;
    }
    if (verb === 'init') {
      if (opts.positional.length) throw new Error('hfs init takes no path');
      const result = initRepo({ repoRoot, write: !opts.stdout });
      if (opts.stdout) stdout(result.text); else stdout(`hfs init: wrote ${result.file} (${result.declaration.profile}, ${result.declaration.apps.map((a) => `${a.name}:${a.kind}`).join(', ')})\n`);
      return 0;
    }
    if (opts.positional.length !== 1) throw new Error('hfs explain takes exactly one path');
    const explained = explainPath({ repoRoot, input: opts.positional[0] });
    if (opts.json) stdout(`${JSON.stringify(explained, null, 2)}\n`); else printExplain(explained, stdout);
    return explained.status === 'no-slot' || explained.status === 'ambiguous' ? 1 : 0;
  } catch (error) {
    stderr(error instanceof HfsSlotsError || error instanceof SyncError ? `${error.message}\n` : `hfs: ${error.message}\n${USAGE}`);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
