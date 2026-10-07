// test-topology.mjs - BE_TEST_TOPOLOGY (R47), the tree half of BE-CONVENTION 1.16: four test kinds by folder, one jest configuration.
//   - a unit spec is `<name>.spec.ts`: a tracked `*.test.*` file is refused;
//   - there is no `testing/` folder: doubles and builders live in `src/tests/fixtures/`, next to the subject as `*.spec.ts`;
//   - one `jest.config.js` at the root: a second jest config (`jest.config.<x>.js`, `jest.<x>.config.*`, one per app) and a
//     `jest` key in a package.json are refused.
// `int-spec`, `harness-spec`, the unsupported test folders and the per-lane configs under src/tests are the architecture machine's
// (reported under this same code, BE_TEST_TOPOLOGY); that jest.config.js is the rendered one (projects `unit`, `integration`, `e2e` and
// `contract`, diagnostics off) is the managed-file check's (HFS_MANAGED_FILE_DRIFT); a spec whose suffix disagrees with its src/tests folder has no slot (HFS_SLOT_UNDECLARED).
import { found, readJson } from './read.mjs';

const TEST_TOPOLOGY = 'BE_TEST_TOPOLOGY';
const DOT_TEST = /\.test\.[cm]?[jt]sx?$/;
const JEST_CONFIG_SOURCE = String.raw`(?:^|\/)jest(?:\.[^/]+)?\.config(?:\.[^/]+)?\.(?:[cm]?[jt]s|json)$|(?:^|\/)jest\.config\.[^/]+$`;
const JEST_CONFIG = new RegExp(JEST_CONFIG_SOURCE);
const ROOT_JEST_CONFIG = 'jest.config.js';

/** The findings of R47 over the tracked paths `files` of a back-end repository at `repoRoot`. */
export function testTopologyFindings({ repoRoot, files }) {
  const findings = [];
  for (const file of files) {
    const segments = file.split('/');
    if (DOT_TEST.test(file)) findings.push(found(TEST_TOPOLOGY, file, `${file} is a \`.test\` file; a unit spec is <name>.spec.ts beside its subject and an integration, e2e or contract spec is *.integration-spec.ts, *.e2e-spec.ts or *.contract-spec.ts under its own src/tests folder`));
    else if (segments.slice(0, -1).includes('testing')) findings.push(found(TEST_TOPOLOGY, file, `${file} sits in a testing/ folder; doubles and builders live in src/tests/fixtures/ and specs sit beside their subject`));
    else if (JEST_CONFIG.test(file) && file !== ROOT_JEST_CONFIG) findings.push(found(TEST_TOPOLOGY, file, `${file} is a second jest configuration; the one root ${ROOT_JEST_CONFIG} declares the projects unit, integration, e2e and contract`));
    if (file === 'package.json' || file.endsWith('/package.json')) {
      if (file.includes('node_modules/')) continue;
      const pkg = readJson(repoRoot, file);
      if (pkg && Object.hasOwn(pkg, 'jest')) findings.push(found(TEST_TOPOLOGY, file, `${file} carries a jest key; jest is configured only by the root ${ROOT_JEST_CONFIG}`));
    }
  }
  return findings;
}
