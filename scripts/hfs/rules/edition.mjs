// edition.mjs - L01, the edition rule. An hfs.json edition is `full` or `lite` (absent means full); under lite the standard is a
// filter plus a few additions over the same manifest, never a second engine. The slot layer already answers the paths lite
// removed (slots lite excludes, or whose litePresence is forbidden, come back HFS_FORBIDDEN_PRESENT with their goesTo); this
// rule reports what no path can state:
//   - inside a package.json: a test script (`test`, `test:*`, `typecheck:tests`, a jest/vitest/playwright/mocha/cypress or
//     `node --test` command) or a jest/vitest/playwright dependency - the same vocabulary FE_NO_TESTS scans on the fe side;
//   - a test-tool configuration file no more specific slot already forbids;
//   - a declaration of what lite does not have: a worker app, an event pattern (event-bus, queue, fenced-job, projection,
//     saga) or its trigger kinds (saga, reactors, jobs, realtime). The forbidden names are DERIVED - a pattern, trigger or
//     app kind is gone under lite exactly when every slot that carries it is litePresence: forbidden - so adding or
//     restoring a kind is a manifest edit, not an edit here.
// Full edition runs nothing: the rule answers [] and the tree is judged exactly as before.
import { found, readJson } from './read.mjs';
import { litePresenceOf } from '../slots.mjs';
import { DEPENDENCY_SECTIONS, TEST_DEPENDENCY, TEST_RUNNER_COMMAND, TEST_SCRIPT_NAME, TEST_TOOL_FILE } from './fe-no-tests.mjs';

export const HFS_EDITION_FORBIDDEN_PRESENT = 'HFS_EDITION_FORBIDDEN_PRESENT';

const PACKAGE_JSON = /(?:^|\/)package\.json$/;
const TYPECHECK_TESTS = /^(?:pre|post)?typecheck:tests$/;

/**
 * The names lite cannot declare: for each of `pattern`, `trigger` and `appKind`, the value is gone when every slot that
 * carries it is forbidden under lite. Reads the BASE manifest (slots before the edition filter) so a slot that still
 * exists but is forbidden in lite counts.
 */
function liteGone(manifest) {
  const tally = new Map();
  for (const slot of manifest.slots) {
    const forbidden = slot.profiles.every((profile) => litePresenceOf(slot, profile) === 'forbidden');
    for (const field of ['pattern', 'trigger', 'appKind']) {
      if (slot[field] === undefined) continue;
      const key = `${field}:${slot[field]}`;
      const entry = tally.get(key) ?? { total: 0, forbidden: 0 };
      entry.total += 1;
      entry.forbidden += forbidden ? 1 : 0;
      tally.set(key, entry);
    }
  }
  const gone = { pattern: new Set(), trigger: new Set(), appKind: new Set() };
  for (const [key, entry] of tally) {
    if (entry.total !== entry.forbidden) continue;
    const [field, name] = key.split(':');
    gone[field].add(name);
  }
  return gone;
}

/** The findings one package.json's scripts and dependencies produce under lite. */
function packageFindings(repoRoot, rel) {
  const pkg = readJson(repoRoot, rel);
  if (pkg === null || typeof pkg !== 'object' || Array.isArray(pkg)) return [];
  const findings = [];
  const scripts = typeof pkg.scripts === 'object' && pkg.scripts !== null && !Array.isArray(pkg.scripts) ? pkg.scripts : {};
  for (const [name, command] of Object.entries(scripts)) {
    if (TEST_SCRIPT_NAME.test(name) || TYPECHECK_TESTS.test(name) || TEST_RUNNER_COMMAND.test(String(command))) {
      findings.push(found(HFS_EDITION_FORBIDDEN_PRESENT, rel, `${rel} has script ${JSON.stringify(name)}: the lite edition has no tests - a lite app does not typecheck or run a test world`, { name }));
    }
  }
  for (const section of DEPENDENCY_SECTIONS) {
    const deps = pkg[section];
    if (typeof deps !== 'object' || deps === null || Array.isArray(deps)) continue;
    for (const name of Object.keys(deps)) {
      if (TEST_DEPENDENCY.test(name)) {
        findings.push(found(HFS_EDITION_FORBIDDEN_PRESENT, rel, `${rel} ${section} has ${name}: the lite edition has no tests - the dependency belongs to the full edition`, { section, name }));
      }
    }
  }
  return findings;
}

/** The findings one be-side declaration produces under lite: a worker app, an event pattern or a gone trigger kind. */
function declarationFindings(repo, gone) {
  const findings = [];
  for (const app of repo.apps ?? []) {
    if (gone.appKind.has(app.kind)) {
      findings.push(found(HFS_EDITION_FORBIDDEN_PRESENT, 'hfs.json', `hfs.json declares the ${app.kind} app ${app.name}: a ${app.kind} belongs to the full edition, a lite app has none`, { app: app.name, kind: app.kind }));
    }
  }
  for (const [field, goneNames] of [['pattern', gone.pattern], ['trigger', gone.trigger]]) {
    const declared = field === 'pattern' ? (repo.patterns ?? []) : (repo.kinds ?? []);
    for (const name of declared) {
      if (goneNames.has(name)) {
        findings.push(found(HFS_EDITION_FORBIDDEN_PRESENT, 'hfs.json', `hfs.json ${field === 'pattern' ? 'declares' : 'names'} the ${name} ${field}: ${name} belongs to the full edition, a lite app has none`, { name }));
      }
    }
  }
  return findings;
}

/**
 * L01 for one scope (the app root or one side), over `files` (scope-relative). A no-op outside lite. The declaration
 * findings are judged from the be side (its apps, patterns and kinds): the root scope looks at sides.be, a standalone
 * be-side check at its own view. `withDeclaration: false` (a side scope of a whole-app check) skips them: the root scope
 * already reported them on hfs.json, and the side scope would only repeat them on a path that is not this side's.
 */
export function editionFindings({ repoRoot, files, repo, resolver, manifest, withDeclaration = true }) {
  if ((repo.edition ?? 'full') !== 'lite') return [];
  const gone = liteGone(manifest);
  const beView = !withDeclaration ? null : (repo.profile === 'app' ? repo.sides?.be : (repo.profile === 'be' ? repo : null));
  const findings = beView ? declarationFindings(beView, gone) : [];
  for (const file of files) {
    if (file.includes('node_modules/')) continue;
    if (PACKAGE_JSON.test(file)) {
      findings.push(...packageFindings(repoRoot, file));
    } else if (TEST_TOOL_FILE.test(file) && resolver.classifyPath(file).status !== 'forbidden') {
      findings.push(found(HFS_EDITION_FORBIDDEN_PRESENT, file, `${file} is test tooling: the lite edition has no tests - the file belongs to the full edition`));
    }
  }
  return findings;
}
