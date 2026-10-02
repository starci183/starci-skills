// runtime-check.mjs - the runtime HFS check: the StarCi runtime repository judged by its own standard,
// knowledge/hfs/runtime-slots.yaml (manifest kind runtime), through the one HFS engine the products use.
//   1. the tree law (rules R01, R02, R03): checkRepo() of scripts/hfs/check.mjs with the runtime manifest -
//      HFS_SLOT_UNDECLARED, HFS_SLOT_AMBIGUOUS, HFS_FORBIDDEN_PRESENT, HFS_TRACKED_MUST_BE_IGNORED, HFS_SLOT_REQUIRED_MISSING,
//      HFS_MIN_INSTANCES, HFS_EMPTY_DIR, HFS_GHOST_TREE, HFS_UNTRACKED_ROOT_ENTRY - plus each slot's allows/forbids
//      (runtime-rules/slot-allows.mjs)
//   2. the runtime rules of knowledge/hfs/rules.yaml with gate runtime, one module each under scripts/hfs/runtime-rules/:
//      RT_EXTERNAL_OWNER, RT_TIER_DIRECTION and ARCH_OWNER_CYCLE, RT_BASE_IMPURE, RT_API_SHAPE, RT_SPEC_PLACEMENT,
//      RT_SOURCE_NAME, RT_RETIRED_PRESENT, RT_PINNED_PATH_MOVED, HFS_SIZE_GROWTH, RT_NODE_MODULES_LINK, RT_CONTROL_CHARACTER,
//      RT_ABSOLUTE_PATH, RT_GENERATED_DRIFT (the generated copies against scripts/hfs/sync-runtime.mjs) and
//      GENERATED_UNTRACKED (no tracked path under a generated root)
//   3. the findings another emitter produced for the same tree (`extraFindings`: RT_CITED_PATH_MISSING of
//      scripts/checks/check-contract-cites.mjs, passed in by scripts/checks/check-runtime.mjs, the `starci check` driver)
// The base revision is the merge-base of HEAD with main (else origin/main); without one, growth is not judged. Only error
// findings fail. The generated copies are git-ignored output, so on this runtime it regenerates them before judging their
// drift; it writes nothing else.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { mergeBase } from '../api/git/merge-base.mjs';
import { show } from '../api/git/show.mjs';
import { checkRepo, readWhy, trackedFiles } from './check.mjs';
import { GENERATED_DRIFT, driftOfRuntime, syncRuntime } from './sync-runtime.mjs';
import { generatedUntrackedFindings } from './runtime-rules/generated-untracked.mjs';
import { RUNTIME_MANIFEST_FILE, createSlotResolver, loadSlotManifest, readRepoDeclaration, ruleParams } from './slots.mjs';
import { absolutePathRepoFindings } from './runtime-rules/absolute-path.mjs';
import { apiShapeFindings } from './runtime-rules/api-shape.mjs';
import { basePureFindings } from './runtime-rules/base-pure.mjs';
import { ciUploadFindings } from './runtime-rules/ci-upload.mjs';
import { controlCharFindings } from './runtime-rules/control-chars.mjs';
import { prosePathFindings } from './runtime-rules/prose-path.mjs';
import { proseRestateFindings } from './runtime-rules/prose-restates.mjs';
import { generatedBlockFindings } from './runtime-rules/generated-block.mjs';
import { ruleIdFindings } from './runtime-rules/rule-ids.mjs';
import { factFindings } from './runtime-rules/facts.mjs';
import { externalOwnerFindings } from './runtime-rules/external-owner.mjs';
import { nodeModulesLinkFindings } from './runtime-rules/node-modules-link.mjs';
import { RETIRED_PATHS_FILE, pinnedFindings, retiredFindings } from './runtime-rules/retired.mjs';
import { sizeFindings } from './runtime-rules/size.mjs';
import { slotAllowsFindings } from './runtime-rules/slot-allows.mjs';
import { parseSource } from './runtime-rules/source-ast.mjs';
import { readTextFile } from '../lib/read-text.mjs';
import { sourceNameFindings } from './runtime-rules/source-name.mjs';
import { specPlacementFindings } from './runtime-rules/test-layout.mjs';
import { tierFindings } from './runtime-rules/tier-direction.mjs';

const SOURCE = /\.(?:mjs|cjs|js)$/;

/** The merge-base of HEAD with main (else origin/main) in `repoRoot` and a reader of files at it; null when none resolves. */
export function baseRevision(repoRoot) {
  for (const ref of ['main', 'origin/main']) {
    const sha = mergeBase(repoRoot, 'HEAD', ref);
    if (sha) return { sha, show: (file) => { const r = show([`${sha}:${file}`], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }); return !r.error && r.status === 0 ? r.stdout : null; } };
  }
  return null;
}

/** The production sources of the runtime: tracked .mjs/.cjs/.js under ruleParams.runtime.sourceRoots, generated copies excluded. */
function runtimeSources(files, params) {
  const roots = params.sourceRoots;
  const generated = params.generated.map((g) => `${g.root}/`);
  return files.filter((f) => SOURCE.test(f) && roots.some((r) => f === r || f.startsWith(`${r}/`)) && !generated.some((g) => f.startsWith(g)));
}

/**
 * The runtime check of the repository at `repoRoot` (default: this runtime). `files` overrides git ls-files (a dry run; no
 * tree walk), `base` the base revision ({sha, show(path) -> text|null} or null), `drift` the generated-copy differences
 * (a list of strings; default on this runtime: the copies are git-ignored, so syncRuntime() runs first and driftOfRuntime()
 * judges what it leaves).
 * `extraFindings` are findings another emitter produced for the same tree - or a () => list, run after the generated
 * copies are synced so a disk-reading emitter (check-contract-cites) sees them on a checkout that lacked them.
 * Returns {ok, findings (errors), counts, manifest, tracked, sources, base}.
 */
export function runtimeCheck({ repoRoot = skillRoot, root = skillRoot, files, tree = files === undefined, base, drift, extraFindings = [], manifest } = {}) {
  const runtimeManifest = manifest ?? loadSlotManifest({ root, file: path.join(repoRoot, RUNTIME_MANIFEST_FILE) });
  const repo = readRepoDeclaration(runtimeManifest, repoRoot);
  const resolver = createSlotResolver(runtimeManifest, repo);
  const params = ruleParams(runtimeManifest, 'runtime');
  const tracked = files ?? trackedFiles(repoRoot);
  const fileSet = new Set(tracked);
  const read = (rel) => readTextFile(repoRoot, rel);
  const readBytes = (rel) => { try { return fs.readFileSync(path.join(repoRoot, rel)); } catch { return null; } };
  const sourcePaths = runtimeSources(tracked, params);
  const sources = sourcePaths.map((p) => ({ path: p, text: read(p) ?? '' }));
  const parsedCache = new Map();
  const parsed = (p) => {
    if (!parsedCache.has(p)) parsedCache.set(p, parseSource(sources.find((s) => s.path === p)?.text ?? read(p) ?? '', p));
    return parsedCache.get(p);
  };
  const retiredPaths = (() => { const text = read(RETIRED_PATHS_FILE); try { return text === null ? {} : (parseYaml(text) ?? {}); } catch { return {}; } })();
  const baseRev = base === undefined ? baseRevision(repoRoot) : base;
  const ctx = { repoRoot, root, manifest: runtimeManifest, resolver, params, files: tracked, fileSet, sources, sourceSet: new Set(sourcePaths), parsed, read, readBytes, retiredPaths, base: baseRev };

  const findings = [];
  const treeResult = checkRepo({ repoRoot, root, manifest: runtimeManifest, files: tracked, tree });
  findings.push(...treeResult.findings.filter((f) => f.level === 'error'));
  findings.push(
    ...slotAllowsFindings(ctx),
    ...externalOwnerFindings(ctx),
    ...tierFindings(ctx),
    ...basePureFindings(ctx),
    ...apiShapeFindings(ctx),
    ...specPlacementFindings(ctx),
    ...sourceNameFindings(ctx),
    ...retiredFindings(ctx),
    ...pinnedFindings(ctx),
    ...sizeFindings(ctx),
    ...nodeModulesLinkFindings(ctx),
    ...controlCharFindings(ctx),
    ...absolutePathRepoFindings(ctx),
    ...generatedUntrackedFindings(ctx),
    ...factFindings(ctx),
    ...ruleIdFindings(ctx),
    ...generatedBlockFindings(ctx),
    ...prosePathFindings(ctx),
    ...proseRestateFindings(ctx),
    ...ciUploadFindings(ctx),
  );
  let driftList = drift;
  if (drift === undefined && path.resolve(repoRoot) === path.resolve(skillRoot)) {
    // The copies are git-ignored: a checkout without them is the normal state, so the check regenerates them first and a
    // missing/stale/extra file afterwards is true drift. A sync failure reports as drift.
    try { syncRuntime(); } catch (error) { driftList = [`the generator could not regenerate the copies: ${String(error?.message ?? error).split('\n')[0]}`]; }
    driftList ??= driftOfRuntime();
  }
  for (const problem of driftList ?? []) findings.push({ code: GENERATED_DRIFT, level: 'error', path: problem.replace(/^\S+\s+/, ''), message: `${GENERATED_DRIFT} ${problem}: a generated copy differs from what scripts/hfs/sync-runtime.mjs writes - run it` });
  findings.push(...(typeof extraFindings === 'function' ? extraFindings() : extraFindings));

  const why = readWhy(root, [...new Set(findings.map((f) => f.code))]);
  const withWhy = (f) => ({ ...f, titleVi: why[f.code]?.titleVi, whyVi: why[f.code]?.whyVi, nextStepVi: why[f.code]?.nextStepVi });
  const byCode = {};
  for (const f of findings) byCode[f.code] = (byCode[f.code] ?? 0) + 1;
  return {
    ok: findings.length === 0,
    manifest: runtimeManifest.version,
    tracked: tracked.length,
    sources: sources.length,
    base: baseRev ? baseRev.sha : null,
    findings: findings.map(withWhy),
    counts: { error: findings.length, byCode },
  };
}

