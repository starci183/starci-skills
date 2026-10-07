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
const JEST_CONFIG_NAMED = /(?:^|\/)jest(?:\.[^/]+)?\.config(?:\.[^/]+)?\.(?:[cm]?[jt]s|json)$/;
const JEST_CONFIG_ANY_EXTENSION = /(?:^|\/)jest\.config\.[^/]+$/;
const ROOT_JEST_CONFIG = 'jest.config.js';

const isJestConfig = (file) => JEST_CONFIG_NAMED.test(file) || JEST_CONFIG_ANY_EXTENSION.test(file);

/** The finding of the tracked file's own path, else null. */
function pathFinding(file) {
  if (DOT_TEST.test(file)) return found(TEST_TOPOLOGY, file, `${file} is a \`.test\` file; a unit spec is <name>.spec.ts beside its subject and an integration, e2e or contract spec is *.integration-spec.ts, *.e2e-spec.ts or *.contract-spec.ts under its own src/tests folder`);
  if (file.split('/').slice(0, -1).includes('testing')) return found(TEST_TOPOLOGY, file, `${file} sits in a testing/ folder; doubles and builders live in src/tests/fixtures/ and specs sit beside their subject`);
  if (isJestConfig(file) && file !== ROOT_JEST_CONFIG) return found(TEST_TOPOLOGY, file, `${file} is a second jest configuration; the one root ${ROOT_JEST_CONFIG} declares the projects unit, integration, e2e and contract`);
  return null;
}

/** The finding of a package.json that carries a `jest` key, else null. */
function packageFinding(repoRoot, file) {
  if (file !== 'package.json' && !file.endsWith('/package.json')) return null;
  if (file.includes('node_modules/')) return null;
  const pkg = readJson(repoRoot, file);
  return pkg && Object.hasOwn(pkg, 'jest') ? found(TEST_TOPOLOGY, file, `${file} carries a jest key; jest is configured only by the root ${ROOT_JEST_CONFIG}`) : null;
}

/** The findings of R47 over the tracked paths `files` of a back-end repository at `repoRoot`. */
export function testTopologyFindings({ repoRoot, files }) {
  const findings = [];
  for (const file of files) {
    const own = pathFinding(file);
    if (own) findings.push(own);
    const packaged = packageFinding(repoRoot, file);
    if (packaged) findings.push(packaged);
  }
  return findings;
}
