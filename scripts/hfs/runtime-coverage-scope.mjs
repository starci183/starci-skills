// runtime-coverage-scope.mjs - THE derivation of what the runtime measures and analyses in its own tag-run CI (the `runtime` Codecov flag
// and the root Sonar project), from ONE input: the runtime slot manifest (knowledge/hfs/runtime-slots.yaml). Every tracked slot declares
// `coverage: required | none` (the vocabulary of the app manifest, scripts/hfs/coverage-scope.mjs). The measured source is the `.mjs` files
// of the `required` slots (the runtime has no build: node reads its tree directly); a `none` slot inside a required directory is excluded,
// as are the specs and the git-ignored output of any depth the manifest names. No path of the runtime is typed here. Three consumers read it:
//   - the coverage producer (scripts/gates/runtime-coverage.mjs): `runtimeCoverageNodeArgs` are the node:test coverage include and exclude
//     globs of `starci gate runtime-coverage`, so the lcov denominator is this source and not the specs or node_modules;
//   - Codecov: `runtimeCodecovPaths` are the paths of the `runtime` flag, rendered into codecov.yml by scripts/checks/check-examples-ci.mjs;
//   - SonarCloud: `renderRuntimeSonar` is the root sonar-project.properties, rendered by the same generator (sources, tests, exclusions and the
//     lcov report path from `coverage/lcov.info`). It names neither organization nor project key: those are the repository variables
//     SONAR_ORGANIZATION and SONAR_PROJECT_KEY, passed as -D arguments by .github/workflows/ci.yml.
// The examples keep their own flags and Sonar projects (scripts/hfs/coverage-scope.mjs). Pure given a manifest; the default manifest is the runtime's own.
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { braceVariants } from '../lib/glob.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { nested } from './coverage-scope.mjs';
import { RUNTIME_MANIFEST_FILE, loadSlotManifest } from './slots.mjs';

/** The Codecov flag of the runtime. */
export const RUNTIME_FLAG = 'runtime';
const RUNTIME_SONAR_NAME = 'StarCi runtime';
/** The lcov file the coverage producer writes and Codecov and Sonar read, from the repository root. */
export const RUNTIME_LCOV = 'coverage/lcov.info';
/** The slot that holds the root suite: its path is the root of the specs the coverage run executes and Sonar classifies as tests. */
const TESTS_SLOT = 'runtime.tests';
/** The executable source kind of the runtime and the spec naming law (tests/<area>/<module>.spec.mjs, RT_SPEC_PLACEMENT). */
const SOURCE_FILES = '*.mjs';
const SPEC_FILES = '**/*.spec.mjs';

const star = (value) => String(value).replace(/<[^>]+>/g, '*');
const variantsOf = (slot) => braceVariants(slot.path).map(star);
const isDir = (value) => value.endsWith('/');
const segments = (value) => value.split('/').filter(Boolean);
const dirOf = (value) => (isDir(value) ? value : value.slice(0, value.lastIndexOf('/') + 1));
/** True when the directory of `inner` lies inside directory pattern `outer` (an outer `*` segment matches one inner segment). */
const inside = (inner, outer) => nested(dirOf(inner), outer);
/** The literal part of a pattern before its first wildcard segment: a directory (no trailing slash), or the file itself when it has none. */
const literalRoot = (value) => {
  let literal = value;
  if (!isDir(value)) literal = dirOf(value) + (value.includes('*') ? '' : value.slice(value.lastIndexOf('/') + 1));
  const parts = segments(literal);
  const cut = parts.findIndex((part) => part.includes('*'));
  return (cut < 0 ? parts : parts.slice(0, cut)).join('/');
};
let defaultManifest = null;
const runtimeManifest = () => (defaultManifest ??= loadSlotManifest({ file: path.join(skillRoot, RUNTIME_MANIFEST_FILE) }));

/**
 * The runtime's scope derived from `manifest`: { include, sources, excludes, testRoots, testGlob }.
 *   include    the globs of the measured files (every `.mjs` of a required slot), sorted;
 *   sources    the minimal files and directories that hold them (Sonar sonar.sources), sorted;
 *   excludes   a `none` slot inside a required directory, the specs and the git-ignored paths of the manifest, sorted;
 *   testRoots  the roots of the root suite, testGlob the specs of the coverage run.
 */
export function runtimeCoverageScope(manifest = runtimeManifest()) {
  const tracked = manifest.slots.filter((slot) => slot.tracked === 'tracked');
  const required = tracked.filter((slot) => slot.coverage === 'required').flatMap(variantsOf);
  const none = tracked.filter((slot) => slot.coverage === 'none').flatMap(variantsOf);
  const requiredDirs = required.filter(isDir);
  for (const variant of required) {
    const name = path.posix.basename(variant);
    if (!isDir(variant) && !name.includes('*') && !name.endsWith('.mjs')) throw new Error(`a coverage: required slot holds ${variant}, which is not a ${SOURCE_FILES} source`);
  }
  const measured = [...new Set(required.filter((variant) => !requiredDirs.some((dir) => dir !== variant && inside(variant, dir))))];
  const include = measured.map((variant) => (isDir(variant) ? `${variant}**/${SOURCE_FILES}` : variant)).sort(byCodeUnit);
  const roots = [...new Set(measured.map(literalRoot))];
  const directoryRoots = new Set(measured.filter((variant) => isDir(variant) || variant.includes('*')).map(literalRoot));
  const sources = roots.filter((root) => ![...directoryRoots].some((dir) => dir !== root && root.startsWith(`${dir}/`))).sort(byCodeUnit);
  const nested = none.filter((variant) => requiredDirs.some((dir) => inside(variant, dir))).map((variant) => (isDir(variant) ? `${variant}**` : variant));
  const ignored = manifest.slots.filter((slot) => slot.tracked === 'ignored').flatMap(variantsOf).filter((variant) => variant.startsWith('**/')).map((variant) => (isDir(variant) ? `${variant}**` : variant));
  const testRoots = tracked.filter((slot) => slot.id === TESTS_SLOT).flatMap(variantsOf).map((variant) => variant.replace(/\/$/, ''));
  return {
    include,
    sources,
    excludes: [...new Set([...nested, SPEC_FILES, ...ignored])].sort(byCodeUnit),
    ignored: [...new Set(ignored)].sort(byCodeUnit),
    testRoots,
    testGlob: `${testRoots[0]}/${SPEC_FILES}`,
  };
}

/** The spec glob the coverage run executes: the same glob `npm test` runs. */
export const runtimeTestGlob = (manifest) => runtimeCoverageScope(manifest).testGlob;

/** The paths of the Codecov `runtime` flag. */
export const runtimeCodecovPaths = (manifest) => runtimeCoverageScope(manifest).include;

/** The node:test coverage options of the coverage run: include the measured files, exclude the specs, the ignored output and nested `none` slots. */
export const runtimeCoverageNodeArgs = (manifest) => {
  const { include, excludes } = runtimeCoverageScope(manifest);
  return ['--experimental-test-coverage', ...include.map((glob) => `--test-coverage-include=${glob}`), ...excludes.map((glob) => `--test-coverage-exclude=${glob}`)];
};

/** The root sonar-project.properties of the runtime (LF, trailing newline). */
export const renderRuntimeSonar = (manifest) => {
  const { sources, excludes, ignored, testRoots } = runtimeCoverageScope(manifest);
  return `# Generated by scripts/checks/check-examples-ci.mjs --write from scripts/hfs/runtime-coverage-scope.mjs. Do not edit: npm run check fails on any difference.
# The runtime's own SonarCloud project: its first-party source, analysed with the lcov of \`starci gate runtime-coverage\` (coverage/lcov.info).
# sonar.organization and sonar.projectKey are not here: .github/workflows/ci.yml passes them from the repository variables SONAR_ORGANIZATION and SONAR_PROJECT_KEY.
sonar.projectName=${RUNTIME_SONAR_NAME}
sonar.sourceEncoding=UTF-8
sonar.sources=${sources.join(',')}
sonar.inclusions=**/${SOURCE_FILES}
sonar.tests=${testRoots.join(',')}
sonar.test.inclusions=${SPEC_FILES}
sonar.test.exclusions=${ignored.join(',')}
sonar.exclusions=${excludes.join(',')}
sonar.javascript.lcov.reportPaths=${RUNTIME_LCOV}
sonar.nodejs.maxspace=8192
`;
};
