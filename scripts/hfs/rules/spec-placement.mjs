// spec-placement.mjs - BE_SPEC_PLACEMENT (R102): a back-end spec or test file lives in one of the four test layers and nowhere else.
//   - a unit spec is `<name>.service.spec.ts` beside its service, in a slot whose `tests` is `unit-beside` (the slot and the lint rule
//     `unit-test-colocated` judge the name);
//   - integration, e2e and contract specs are `src/tests/{integration,e2e,contract}/...`, the slots whose `tests` is `e2e`;
// Every other tracked `*.spec.*`, `*.test.*` or `*-spec.*` file is a finding, `scripts/` and `tools/` included: an operational script
// carries no spec, and a spec that guards one moves into a layer or goes. A file no slot owns (`tools/x.spec.ts`) is judged too, so the
// finding names the rule rather than only the missing slot. Which folder is a layer is read from the slot manifest, never spelled here.
import { found } from './read.mjs';

export const SPEC_PLACEMENT = 'BE_SPEC_PLACEMENT';
const SPEC_FILE = /(?:\.(?:spec|test)|-spec)\.[cm]?[jt]sx?$/;
const TEST_SLOT_TESTS = new Set(['unit-beside', 'e2e']);

/** True for a file name that is a spec or a test. */
export const isSpecFile = (file) => SPEC_FILE.test(file);

/** The findings of R102 over the tracked paths `files` of a back-end repository; `resolver` names the slots. */
export function specPlacementFindings({ files, resolver }) {
  const findings = [];
  for (const file of files) {
    if (!isSpecFile(file) || file.includes('node_modules/')) continue;
    const classified = resolver.classifyPath(file);
    const slot = classified.status === 'owned' ? resolver.slot(classified.slot) : null;
    if (slot && TEST_SLOT_TESTS.has(slot.tests)) continue;
    const where = slot ? `slot ${slot.id}` : 'no slot';
    findings.push(found(SPEC_PLACEMENT, file, `${file} is a spec outside the test layers (${where}); a unit spec is <name>.service.spec.ts beside its service and an integration, e2e or contract spec sits under src/tests/{integration,e2e,contract}; an operational script or a tool carries no spec`));
  }
  return findings;
}
