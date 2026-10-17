// test-layout.mjs - RT_SPEC_PLACEMENT (knowledge/hfs/rules.yaml R118, gate runtime): NO runtime tests in .claude (owner ruling no-runtime-specs, 2026-10-17:
// "Tests in packages/ and examples/ stay; the .claude runtime's own specs are removed entirely"). A spec or test file (<name>.spec.* / <name>.test.*) is allowed in
// exactly three homes, and every other tracked one - tests/**, scripts/, engine/, modules/, ui/, e2e/ outside the declared files - is refused:
//   packages/<pkg>/**/<name>.spec.*   a package spec beside its source (every package-tier slot that lists RT_SPEC_PLACEMENT), run by `starci release clean-test`; never .test.
//   examples/**                       the example apps' own tests
//   the scaffold e2e                  the files of the slot runtime.e2e (e2e/), run by `starci release scaffold-e2e` and `starci release app-installs`
// A runtime test is a spec that exercises the runtime's own code (scripts/, modules/, the kernel, supervisor and work graph, checks, gates, CLI internals) outside
// packages/ and examples/; the runtime is proven by the package specs and the scaffold e2e instead. Generated copies are not judged. Pure.
import path from 'node:path';

export const CODE = 'RT_SPEC_PLACEMENT';
/** The slot that holds the scaffold e2e harness: its files are the only specs of the runtime outside the packages and the examples. */
const E2E_SLOT = 'runtime.e2e';
const TEST_NAME = /\.(?:spec|test)\.[cm]?[jt]sx?$/;
const TEST_SUFFIX = /\.test\.[cm]?[jt]sx?$/;
const EXAMPLES = 'examples/';
const RULING = 'owner ruling no-runtime-specs: no runtime tests in .claude; a test lives in packages/ (beside its source), in examples/, or is the scaffold e2e (slot runtime.e2e)';

/** The ids of the slots that hold package source (tier package, RT_SPEC_PLACEMENT listed): their specs sit beside the source. */
const packageSlotsOf = (manifest) => new Set(manifest.slots.filter((slot) => slot.tier === 'package' && slot.rules?.includes(CODE)).map((slot) => slot.id));

/** The RT_SPEC_PLACEMENT finding of one tracked file (owned by slot `slotId`, or null; `packageSlots` the package-source slot ids), or null. */
function specPlacementFinding(file, slotId, packageSlots) {
  const add = (why) => ({ code: CODE, level: 'error', path: file, message: `${file} ${why}` });
  if (!TEST_NAME.test(path.posix.basename(file))) return null;
  if (file.startsWith(EXAMPLES) || slotId === E2E_SLOT) return null;
  if (packageSlots.has(slotId)) return TEST_SUFFIX.test(file) ? add('uses the .test. suffix: a package spec is <name>.spec.* beside its source') : null;
  return add(`is a runtime test (${RULING})`);
}

/** RT_SPEC_PLACEMENT over every tracked file of the runtime (ctx of scripts/hfs/runtime-check.mjs); generated copies are skipped. */
export function specPlacementFindings(ctx) {
  const found = [], packageSlots = packageSlotsOf(ctx.manifest);
  for (const file of ctx.files) {
    const c = ctx.resolver.classifyPath(file);
    if (c.status === 'owned' && c.tracking !== 'tracked') continue;
    const finding = specPlacementFinding(file, c.status === 'owned' ? c.slot : null, packageSlots);
    if (finding) found.push(finding);
  }
  return found;
}
