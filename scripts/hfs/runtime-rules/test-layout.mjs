// test-layout.mjs - RT_SPEC_PLACEMENT (knowledge/hfs/rules.yaml, gate runtime): one test layout for the runtime.
//   tests/<area>/<module>[.<topic>].spec.mjs   a runtime spec; <area> is the source area with / as - (api-orca, kernel-verbs)
//   tests/helpers/<name>.mjs                   shared spec code (no _ prefix)
//   tests/setup/<name>.mjs                     --import preloads
//   tests/fixtures/**                          spec data
//   packages/<pkg>/**/<name>.spec.*            a package spec beside its source; there is no .test. suffix anywhere
// A spec or test file anywhere else (scripts/, engine/, bin/) is misplaced too. The tests root and the package roots come
// from their slots (runtime.tests, runtime.package); generated copies are not judged. Pure.
import path from 'node:path';

export const CODE = 'RT_SPEC_PLACEMENT';
const KEBAB = '[a-z0-9]+(?:-[a-z0-9]+)*';
const SPEC = new RegExp(`^tests/(${KEBAB})/${KEBAB}(?:\\.${KEBAB})?\\.spec\\.mjs$`);
const SUPPORT = new RegExp(`^tests/(?:helpers|setup)/${KEBAB}\\.mjs$`);
const SUPPORT_AREAS = new Set(['helpers', 'setup', 'fixtures']);
const TEST_NAME = /\.(?:spec|test)\.[cm]?[jt]sx?$/;
const TEST_SUFFIX = /\.test\.[cm]?[jt]sx?$/;

/** The RT_SPEC_PLACEMENT finding of one tracked file (slot `slotId`), or null. */
export function specPlacementFinding(file, slotId) {
  const add = (why) => ({ code: CODE, level: 'error', path: file, message: `${file} ${why}` });
  if (slotId === 'runtime.tests') {
    if (file.startsWith('tests/fixtures/')) return null;
    if (SUPPORT.test(file)) return null;
    const spec = SPEC.exec(file);
    if (spec && !SUPPORT_AREAS.has(spec[1])) return null;
    if (/^tests\/[^/]+\.spec\.mjs$/.test(file)) return add('is a flat spec: a runtime spec is tests/<area>/<module>[.<topic>].spec.mjs, <area> the source area of the module it covers');
    if (/^tests\/_/.test(file)) return add('is shared spec code with a _ prefix at the tests root: it belongs in tests/helpers/<name>.mjs');
    return add('is outside the test layout: tests/<area>/<module>[.<topic>].spec.mjs, tests/helpers/<name>.mjs, tests/setup/<name>.mjs or tests/fixtures/**');
  }
  if (slotId === 'runtime.package') return TEST_SUFFIX.test(file) ? add('uses the .test. suffix: a package spec is <name>.spec.* beside its source') : null;
  return TEST_NAME.test(path.posix.basename(file)) ? add('is a spec outside tests/ and the packages: runtime specs live under tests/<area>/') : null;
}

/** RT_SPEC_PLACEMENT over every tracked file of the runtime (ctx of scripts/hfs/runtime-check.mjs). */
export function specPlacementFindings(ctx) {
  const found = [];
  for (const file of ctx.files) {
    const c = ctx.resolver.classifyPath(file);
    if (c.status !== 'owned' || c.tracking !== 'tracked') continue;
    const sourceArea = ctx.sourceSet.has(file);
    if (c.slot !== 'runtime.tests' && c.slot !== 'runtime.package' && !sourceArea) continue;
    const finding = specPlacementFinding(file, c.slot);
    if (finding) found.push(finding);
  }
  return found;
}
