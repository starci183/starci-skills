// test-layout.mjs - RT_SPEC_PLACEMENT (knowledge/hfs/rules.yaml, gate runtime): one test layout for the runtime.
//   tests/<area>/<module>[.<topic>].spec.mjs   a runtime spec; <area> is the source area with / as - (api-orca, kernel-verbs)
//   tests/helpers/<name>.mjs                   shared spec code (no _ prefix)
//   tests/setup/<name>.mjs                     --import preloads
//   tests/fixtures/**                          spec data
//   packages/<pkg>/**/<name>.spec.*            a package spec beside its source; there is no .test. suffix anywhere
// A spec or test file anywhere else (scripts/, engine/, bin/) is misplaced too. The tests root and the package roots come
// from their slots (runtime.tests, and every package-tier slot that lists RT_SPEC_PLACEMENT: runtime.package, runtime.cli-source); generated copies are not judged. Pure.
import path from 'node:path';

export const CODE = 'RT_SPEC_PLACEMENT';
const KEBAB = '[a-z0-9]+(?:-[a-z0-9]+)*';
const SPEC = new RegExp(String.raw`^tests/(${KEBAB})/${KEBAB}(?:\.${KEBAB})?\.spec\.mjs$`);
const SUPPORT = new RegExp(String.raw`^tests/(?:helpers|setup)/${KEBAB}\.mjs$`);
const SUPPORT_AREAS = new Set(['helpers', 'setup', 'fixtures']);
const TEST_NAME = /\.(?:spec|test)\.[cm]?[jt]sx?$/;
const TEST_SUFFIX = /\.test\.[cm]?[jt]sx?$/;

/** The ids of the slots that hold package source (tier package, RT_SPEC_PLACEMENT listed): their specs sit beside the source. */
export const packageSlotsOf = (manifest) => new Set(manifest.slots.filter((slot) => slot.tier === 'package' && slot.rules?.includes(CODE)).map((slot) => slot.id));

function runtimeSpecFinding(file, add) {
  if (file.startsWith('tests/fixtures/')) return null;
  if (SUPPORT.test(file)) return null;
  const spec = SPEC.exec(file);
  if (spec && !SUPPORT_AREAS.has(spec[1])) return null;
  if (/^tests\/[^/]+\.spec\.mjs$/.test(file)) return add('is a flat spec: a runtime spec is tests/<area>/<module>[.<topic>].spec.mjs, <area> the source area of the module it covers');
  if (file.startsWith('tests/_')) return add('is shared spec code with a _ prefix at the tests root: it belongs in tests/helpers/<name>.mjs');
  return add('is outside the test layout: tests/<area>/<module>[.<topic>].spec.mjs, tests/helpers/<name>.mjs, tests/setup/<name>.mjs or tests/fixtures/**');
}

/** The RT_SPEC_PLACEMENT finding of one tracked file (slot `slotId`; `packageSlots` the package-source slot ids), or null. */
export function specPlacementFinding(file, slotId, packageSlots) {
  const add = (why) => ({ code: CODE, level: 'error', path: file, message: `${file} ${why}` });
  if (slotId === 'runtime.tests') return runtimeSpecFinding(file, add);
  if (packageSlots.has(slotId)) return TEST_SUFFIX.test(file) ? add('uses the .test. suffix: a package spec is <name>.spec.* beside its source') : null;
  return TEST_NAME.test(path.posix.basename(file)) ? add('is a spec outside tests/ and the packages: runtime specs live under tests/<area>/') : null;
}

/** RT_SPEC_PLACEMENT over every tracked file of the runtime (ctx of scripts/hfs/runtime-check.mjs). */
export function specPlacementFindings(ctx) {
  const found = [], packageSlots = packageSlotsOf(ctx.manifest);
  for (const file of ctx.files) {
    const c = ctx.resolver.classifyPath(file);
    if (c.status !== 'owned' || c.tracking !== 'tracked') continue;
    const sourceArea = ctx.sourceSet.has(file);
    if (c.slot !== 'runtime.tests' && !packageSlots.has(c.slot) && !sourceArea) continue;
    const finding = specPlacementFinding(file, c.slot, packageSlots);
    if (finding) found.push(finding);
  }
  return found;
}
