#!/usr/bin/env node
// hfs - the HFS command line of a StarCi product repository.
//   hfs check   [--repo <dir>] [--json] [--fast] [--base <ref>]
//                                            every tracked path has a slot; required files exist; nothing forbidden or
//                                            tracked-that-must-be-ignored; pins match; every managed file equals its render
//                                            (sync/managed.mjs); no empty or ghost directory, no untracked
//                                            entry outside an ignored slot; soft-size backlog (report only); then the whole
//                                            architecture machine (tiers, owners, clones, dead exports, module registration, the
//                                            front-end and back-end source rules), each violation a finding with its why.
//                                            --fast: only what changed since the merge-base with origin/main (else main; --base
//                                            overrides it, and without --fast is the base of the size-growth check); the machine
//                                            runs on those owners without clones and dead exports. No merge-base is a refusal
//                                            (exit 2), never a silent full pass. Exit 1 on any error-level finding.
//   hfs init    [--repo <dir>] [--stdout]   write a starter hfs.json by detecting the profile and the apps.
//   hfs explain <path> [--repo <dir>] [--json]   which slot owns the path, its tier, allowed imports, required tests.
//   hfs sync (--check | --write) [--root <dir>]  the generated files (husky, CI, .gitignore block, sonar, codecov); sync/cli.mjs
//   hfs work-hygiene                              the pre-commit guard for staged .starciwork and .starcistacks paths; sync/cli.mjs
// Every finding names a why code and carries its Vietnamese text. The command reads the repository, never writes to it
// (init writes hfs.json only, and only when none exists). Exit codes: 0 clean, 1 error findings, 2 a refusal or bad usage.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRepository, explainPath, initRepo, trackedFiles } from '../runtime/scripts/lib/hfs-check.mjs';
import { HfsSlotsError } from '../runtime/scripts/lib/hfs-slots.mjs';
import { main as syncMain } from '../sync/cli.mjs';
import { SyncError } from '../sync/index.mjs';
import { managedFindings } from '../sync/managed.mjs';

const USAGE = `hfs check [--repo <dir>] [--json] [--fast] [--base <ref>]
hfs init [--repo <dir>] [--stdout]
hfs explain <path> [--repo <dir>] [--json]
hfs sync (--check | --write) [--root <dir>]
hfs work-hygiene
`;
const PER_CODE_LIMIT = 25;
const VALUE_FLAGS = new Set(['--repo', '--base']);
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

/** `presets` is a test seam: the coverage denominators sync would load from the repository's installed preset. */
export async function main(argv, { stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s), presets } = {}) {
  const [verb, ...rest] = argv;
  if (!['check', 'init', 'explain', 'sync', 'work-hygiene'].includes(verb)) { stderr(USAGE); return 2; }
  try {
    if (verb === 'sync' || verb === 'work-hygiene') return await syncMain(argv);
    const opts = parse(rest);
    const repoRoot = path.resolve(opts.repo ?? process.cwd());
    if (verb === 'check') {
      if (opts.positional.length) throw new Error('hfs check takes no path');
      const extraFindings = await managedFindings({ repoRoot, tracked: trackedFiles(repoRoot), presets });
      const result = checkRepository({ repoRoot, fast: opts.fast === true, base: opts.base, extraFindings });
      if (opts.json) stdout(`${JSON.stringify(result, null, 2)}\n`); else printCheck(result, stdout);
      return result.ok ? 0 : 1;
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
