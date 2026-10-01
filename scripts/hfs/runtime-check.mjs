// runtime-check.mjs - the runtime HFS check: the StarCi runtime repository judged by its own standard,
// knowledge/hfs/runtime-slots.yaml (manifest kind runtime), through the one HFS engine the products use.
//   1. the tree law (rules R01, R02, R03): checkRepo() of scripts/hfs/check.mjs with the runtime manifest -
//      HFS_SLOT_UNDECLARED, HFS_SLOT_AMBIGUOUS, HFS_FORBIDDEN_PRESENT, HFS_TRACKED_MUST_BE_IGNORED, HFS_SLOT_REQUIRED_MISSING,
//      HFS_MIN_INSTANCES, HFS_EMPTY_DIR, HFS_GHOST_TREE, HFS_UNTRACKED_ROOT_ENTRY - plus each slot's allows/forbids
//      (runtime-rules/slot-allows.mjs)
//   2. the runtime rules of knowledge/hfs/rules.yaml with gate runtime, one module each under scripts/hfs/runtime-rules/:
//      RT_EXTERNAL_OWNER, RT_TIER_DIRECTION and ARCH_OWNER_CYCLE, RT_BASE_IMPURE, RT_API_SHAPE, RT_SPEC_PLACEMENT,
//      RT_SOURCE_NAME, RT_RETIRED_PRESENT, RT_PINNED_PATH_MOVED, HFS_SIZE_GROWTH, RT_NODE_MODULES_LINK, RT_CONTROL_CHARACTER,
//      RT_ABSOLUTE_PATH, RT_GENERATED_DRIFT (the generated copies against scripts/hfs/sync-runtime.mjs)
//   3. the findings another emitter produced for the same tree (`extraFindings`: RT_CITED_PATH_MISSING of
//      scripts/checks/check-contract-cites.mjs, passed in by scripts/checks/check-runtime.mjs, the `starci check` driver)
//   4. the pending ratchet (runtime-rules/pending.mjs): the manifest's `pending` list turns the findings it names into level
//      pending; RT_PENDING_STALE and RT_PENDING_ADDED keep the list shrinking against the base revision
// The base revision is the merge-base of HEAD with main (else origin/main); without one, growth and the ratchet's base
// comparison are not judged. Only error findings fail. It never writes to the tree it judges.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { mergeBase } from '../api/git/merge-base.mjs';
import { show } from '../api/git/show.mjs';
import { checkRepo, readWhy, trackedFiles } from './check.mjs';
import { GENERATED_DRIFT, driftOfRuntime } from './sync-runtime.mjs';
import { RUNTIME_MANIFEST_FILE, createSlotResolver, loadRuleCatalog, loadSlotManifest, readRepoDeclaration, ruleParams } from './slots.mjs';
import { absolutePathRepoFindings } from './runtime-rules/absolute-path.mjs';
import { apiShapeFindings } from './runtime-rules/api-shape.mjs';
import { basePureFindings } from './runtime-rules/base-pure.mjs';
import { controlCharFindings } from './runtime-rules/control-chars.mjs';
import { externalOwnerFindings } from './runtime-rules/external-owner.mjs';
import { nodeModulesLinkFindings } from './runtime-rules/node-modules-link.mjs';
import { applyPending } from './runtime-rules/pending.mjs';
import { RETIRED_PATHS_FILE, movedFrom, pinnedFindings, retiredFindings } from './runtime-rules/retired.mjs';
import { sizeFindings } from './runtime-rules/size.mjs';
import { slotAllowsFindings } from './runtime-rules/slot-allows.mjs';
import { parseSource } from './runtime-rules/source-ast.mjs';
import { sourceNameFindings } from './runtime-rules/source-name.mjs';
import { specPlacementFindings } from './runtime-rules/test-layout.mjs';
import { tierFindings } from './runtime-rules/tier-direction.mjs';

const SOURCE = /\.(?:mjs|cjs|js)$/;
/** The codes only an extra emitter reports (scripts/checks/check-contract-cites.mjs, passed in by the `starci check` driver). */
export const EXTRA_ONLY = new Set(['RT_CITED_PATH_MISSING']);

/** The merge-base of HEAD with main (else origin/main) in `repoRoot` and a reader of files at it; null when none resolves. */
export function baseRevision(repoRoot) {
  for (const ref of ['main', 'origin/main']) {
    const sha = mergeBase(repoRoot, 'HEAD', ref);
    if (sha) return { sha, show: (file) => show(repoRoot, sha, file) };
  }
  return null;
}

/** The `pending` list of the runtime manifest at the base revision, or null when the base has none (or no base). */
export function basePendingOf(base) {
  if (!base) return null;
  const text = base.show(RUNTIME_MANIFEST_FILE);
  if (text === null) return null;
  try { return parseYaml(text)?.pending ?? []; } catch { return null; }
}

/** The production sources of the runtime: tracked .mjs/.cjs/.js under ruleParams.runtime.sourceRoots, generated copies excluded. */
export function runtimeSources(files, params) {
  const roots = params.sourceRoots;
  const generated = params.generated.map((g) => `${g.root}/`);
  return files.filter((f) => SOURCE.test(f) && roots.some((r) => f === r || f.startsWith(`${r}/`)) && !generated.some((g) => f.startsWith(g)));
}

/**
 * The runtime check of the repository at `repoRoot` (default: this runtime). `files` overrides git ls-files (a dry run; no
 * tree walk), `base` the base revision ({sha, show(path) -> text|null} or null), `drift` the generated-copy differences
 * (a list of strings; default: scripts/hfs/sync-runtime.mjs driftOfRuntime when `repoRoot` is this runtime).
 * `extraFindings` are findings another emitter produced (codes in `extraCodes`, whose pending entries are judged only then).
 * Returns {ok, findings (errors), pending (allowed findings), counts, manifest, tracked, sources, base}.
 */
export function runtimeCheck({ repoRoot = skillRoot, root = skillRoot, files, tree = files === undefined, base, drift, extraFindings = [], extraCodes = [], manifest } = {}) {
  const runtimeManifest = manifest ?? loadSlotManifest({ root, file: path.join(repoRoot, RUNTIME_MANIFEST_FILE) });
  const repo = readRepoDeclaration(runtimeManifest, repoRoot);
  const resolver = createSlotResolver(runtimeManifest, repo);
  const params = ruleParams(runtimeManifest, 'runtime');
  const tracked = files ?? trackedFiles(repoRoot);
  const fileSet = new Set(tracked);
  const read = (rel) => { try { return fs.readFileSync(path.join(repoRoot, rel), 'utf8'); } catch { return null; } };
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
  );
  const driftList = drift === undefined && path.resolve(repoRoot) === path.resolve(skillRoot) ? driftOfRuntime() : drift;
  for (const problem of driftList ?? []) findings.push({ code: GENERATED_DRIFT, level: 'error', path: problem.replace(/^\S+\s+/, ''), message: `${GENERATED_DRIFT} ${problem}: a generated copy differs from what scripts/hfs/sync-runtime.mjs writes - run it` });
  findings.push(...extraFindings);

  // The finding codes of the rules that run at the runtime gate: a pending entry naming another code is stale.
  const codes = new Set(loadRuleCatalog({ root }).forGate('runtime').flatMap((r) => r.failureCodes));
  // An entry for a code only an extra emitter reports is judged only when that emitter ran.
  const judgedPending = (runtimeManifest.pending ?? []).filter((e) => !EXTRA_ONLY.has(e.rule) || extraCodes.includes(e.rule));
  const { errors, allowed } = applyPending({ findings, pending: judgedPending, basePending: basePendingOf(baseRev)?.filter((e) => !EXTRA_ONLY.has(e.rule) || extraCodes.includes(e.rule)) ?? null, oldPathOf: movedFrom(retiredPaths.moved), codes, manifestFile: RUNTIME_MANIFEST_FILE });

  const why = readWhy(root, [...new Set([...errors, ...allowed].map((f) => f.code))]);
  const withWhy = (f) => ({ ...f, titleVi: why[f.code]?.titleVi, whyVi: why[f.code]?.whyVi, nextStepVi: why[f.code]?.nextStepVi });
  const byCode = {};
  for (const f of errors) byCode[f.code] = (byCode[f.code] ?? 0) + 1;
  const pendingByCode = {};
  for (const f of allowed) pendingByCode[f.code] = (pendingByCode[f.code] ?? 0) + 1;
  return {
    ok: errors.length === 0,
    manifest: runtimeManifest.version,
    tracked: tracked.length,
    sources: sources.length,
    base: baseRev ? baseRev.sha : null,
    findings: errors.map(withWhy),
    pending: allowed.map(withWhy),
    counts: { error: errors.length, pending: allowed.length, byCode, pendingByCode },
  };
}

