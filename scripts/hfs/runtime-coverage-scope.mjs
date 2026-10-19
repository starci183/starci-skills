// runtime-coverage-scope.mjs - THE derivation of what the runtime's own Sonar project analyses (the root sonar-project.properties), from ONE input: the runtime slot
// manifest (knowledge/hfs/runtime-slots.yaml). Every tracked slot declares `coverage: required | none` (the vocabulary of the app manifest, scripts/hfs/coverage-scope.mjs):
// the analysed source is the `.mjs` files of the `required` slots (the runtime has no build: node reads its tree directly); a `none` slot inside a required directory is
// excluded, as are the specs and the git-ignored output of any depth the manifest names. No path of the runtime is typed here.
// The runtime measures no coverage of its own: it has no specs (owner ruling no-runtime-specs, 2026-10-17), so Sonar analyses it without an lcov report and Codecov carries
// no runtime flag. `renderRuntimeSonar` is the root sonar-project.properties, rendered by scripts/checks/check-examples-ci.mjs --write. It names neither organization nor
// project key: those are the repository variables SONAR_ORGANIZATION and SONAR_PROJECT_KEY, passed as -D arguments by .github/workflows/ci.yml.
// The examples keep their own flags and Sonar projects (scripts/hfs/coverage-scope.mjs). Pure given a manifest; the default manifest is the runtime's own.
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { braceVariants } from '../lib/glob.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { nested, segments, star } from './coverage-scope.mjs';
import { RUNTIME_MANIFEST_FILE, loadSlotManifest } from './slots.mjs';

const RUNTIME_SONAR_NAME = 'StarCi runtime';
/** The executable source kind of the runtime and the spec naming law (package specs, RT_SPEC_PLACEMENT). */
const SOURCE_FILES = '*.mjs';
const SPEC_FILES = '**/*.spec.mjs';

const variantsOf = (slot) => braceVariants(slot.path).map(star);
const isDir = (value) => value.endsWith('/');
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
 * The runtime's scope derived from `manifest`: { include, sources, excludes, ignored }.
 *   include    the globs of the measured files (every `.mjs` of a required slot), sorted;
 *   sources    the minimal files and directories that hold them (Sonar sonar.sources), sorted;
 *   excludes   a `none` slot inside a required directory, the specs and the git-ignored paths of the manifest, sorted;
 *   ignored    the git-ignored paths of any depth, sorted.
 */
function runtimeCoverageScope(manifest = runtimeManifest()) {
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
  return {
    include,
    sources,
    excludes: [...new Set([...nested, SPEC_FILES, ...ignored])].sort(byCodeUnit),
    ignored: [...new Set(ignored)].sort(byCodeUnit),
  };
}

/** The root sonar-project.properties of the runtime (LF, trailing newline). */
export const renderRuntimeSonar = (manifest) => {
  const { include, sources, excludes } = runtimeCoverageScope(manifest);
  return `# Generated by scripts/checks/check-examples-ci.mjs --write from scripts/hfs/runtime-coverage-scope.mjs. Do not edit: npm run check fails on any difference.
# The runtime's own SonarCloud project: its first-party source, analysed without a coverage report (the runtime has no specs of its own, owner ruling no-runtime-specs).
# sonar.organization and sonar.projectKey are not here: .github/workflows/ci.yml passes them from the repository variables SONAR_ORGANIZATION and SONAR_PROJECT_KEY.
sonar.projectName=${RUNTIME_SONAR_NAME}
sonar.sourceEncoding=UTF-8
sonar.sources=${sources.join(',')}
sonar.inclusions=**/${SOURCE_FILES}
sonar.exclusions=${excludes.join(',')}
sonar.coverage.exclusions=${include.join(',')}
sonar.javascript.node.maxspace=6144
`;
};
