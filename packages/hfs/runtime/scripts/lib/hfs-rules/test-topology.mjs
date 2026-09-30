// test-topology.mjs - BE_TEST_TOPOLOGY (R47), the tree half of BE-CONVENTION 1.16: two test kinds, one jest configuration.
//   - a unit spec is `<name>.spec.ts`: a tracked `*.test.*` file is refused;
//   - there is no `testing/` folder: doubles and builders live in `src/tests/fixtures/`, next to the subject as `*.spec.ts`;
//   - one `jest.config.js` at the root: a second jest config (`jest.config.<x>.js`, `jest.<x>.config.*`, one per app) and a
//     `jest` key in a package.json are refused.
// `int-spec`, `harness-spec`, the retired test folders and the per-lane configs under src/tests are the architecture machine's
// (HFS_TEST_KIND_RETIRED, a sub-code of this rule); that jest.config.js is the rendered one (projects `unit` and `e2e`,
// diagnostics off) is the managed-file check's (HFS_MANAGED_FILE_DRIFT); e2e specs outside src/tests/e2e have no slot (HFS_SLOT_UNDECLARED).
import { found, readJson } from './read.mjs';

export const TEST_TOPOLOGY = 'BE_TEST_TOPOLOGY';
const DOT_TEST = /\.test\.[cm]?[jt]sx?$/;
const JEST_CONFIG = /(?:^|\/)jest(?:\.[^/]+)*\.config(?:\.[^/]+)*\.(?:[cm]?[jt]s|json)$|(?:^|\/)jest\.config\.[^/]+$/;
const ROOT_JEST_CONFIG = 'jest.config.js';

/** The findings of R47 over the tracked paths `files` of a back-end repository at `repoRoot`. */
export function testTopologyFindings({ repoRoot, files }) {
  const findings = [];
  for (const file of files) {
    const segments = file.split('/');
    if (DOT_TEST.test(file)) findings.push(found(TEST_TOPOLOGY, file, `${file} is a \`.test\` file; a unit spec is <name>.spec.ts beside its subject and an e2e spec is *.e2e-spec.ts under src/tests/e2e`));
    else if (segments.slice(0, -1).includes('testing')) findings.push(found(TEST_TOPOLOGY, file, `${file} sits in a testing/ folder; doubles and builders live in src/tests/fixtures/ and specs sit beside their subject`));
    else if (JEST_CONFIG.test(file) && file !== ROOT_JEST_CONFIG) findings.push(found(TEST_TOPOLOGY, file, `${file} is a second jest configuration; the one root ${ROOT_JEST_CONFIG} declares the projects unit and e2e`));
    if (file === 'package.json' || file.endsWith('/package.json')) {
      if (file.includes('node_modules/')) continue;
      const pkg = readJson(repoRoot, file);
      if (pkg && Object.hasOwn(pkg, 'jest')) findings.push(found(TEST_TOPOLOGY, file, `${file} carries a jest key; jest is configured only by the root ${ROOT_JEST_CONFIG}`));
    }
  }
  return findings;
}
