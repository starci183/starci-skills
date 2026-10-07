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
// The edition is never tested here: a full app's view forbids none of these names and keeps its tests, so the rule answers [].
import { found, readJson } from './read.mjs';
import { DEPENDENCY_SECTIONS, TEST_DEPENDENCY, TEST_RUNNER_COMMAND, TEST_SCRIPT_NAME, TEST_TOOL_FILE } from './fe-no-tests.mjs';

export const HFS_EDITION_FORBIDDEN_PRESENT = 'HFS_EDITION_FORBIDDEN_PRESENT';

const PACKAGE_JSON = /(?:^|\/)package\.json$/;
const TYPECHECK_TESTS = /^(?:pre|post)?typecheck:tests$/;

/**
 * The names the edition cannot declare: for each of `pattern`, `trigger` and `appKind`, the value is gone when every slot of
 * the resolver's view that carries it is forbidden there. The view is the edition's own (full forbids none of them), so the
 * rule needs no edition test: a full app has nothing gone.
 */
function editionGone(resolver) {
  const tally = new Map();
  for (const slot of resolver.slots()) {
    const forbidden = slot.presence === 'forbidden';
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

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

function testScriptFindings(rel, pkg) {
  const scripts = isPlainObject(pkg.scripts) ? pkg.scripts : {};
  return Object.entries(scripts)
    .filter(([name, command]) => TEST_SCRIPT_NAME.test(name) || TYPECHECK_TESTS.test(name) || TEST_RUNNER_COMMAND.test(String(command)))
    .map(([name]) => found(HFS_EDITION_FORBIDDEN_PRESENT, rel, `${rel} has script ${JSON.stringify(name)}: the lite edition has no tests - a lite app does not typecheck or run a test world`, { name }));
}

function testDependencyFindings(rel, pkg) {
  const findings = [];
  for (const section of DEPENDENCY_SECTIONS) {
    const deps = pkg[section];
    if (!isPlainObject(deps)) continue;
    for (const name of Object.keys(deps)) {
      if (TEST_DEPENDENCY.test(name)) {
        findings.push(found(HFS_EDITION_FORBIDDEN_PRESENT, rel, `${rel} ${section} has ${name}: the lite edition has no tests - the dependency belongs to the full edition`, { section, name }));
      }
    }
  }
  return findings;
}

/** The findings one package.json's scripts and dependencies produce under lite. */
function packageFindings(repoRoot, rel) {
  const pkg = readJson(repoRoot, rel);
  if (!isPlainObject(pkg)) return [];
  return [...testScriptFindings(rel, pkg), ...testDependencyFindings(rel, pkg)];
}

const goneAppFindings = (repo, gone) => (repo.apps ?? [])
  .filter((app) => gone.appKind.has(app.kind))
  .map((app) => found(HFS_EDITION_FORBIDDEN_PRESENT, 'hfs.json', `hfs.json declares the ${app.kind} app ${app.name}: a ${app.kind} belongs to the full edition, a lite app has none`, { app: app.name, kind: app.kind }));

const goneNameFindings = (field, verb, declared, goneNames) => declared
  .filter((name) => goneNames.has(name))
  .map((name) => found(HFS_EDITION_FORBIDDEN_PRESENT, 'hfs.json', `hfs.json ${verb} the ${name} ${field}: ${name} belongs to the full edition, a lite app has none`, { name }));

/** The findings one be-side declaration produces under lite: a worker app, an event pattern or a gone trigger kind. */
function declarationFindings(repo, gone) {
  return [
    ...goneAppFindings(repo, gone),
    ...goneNameFindings('pattern', 'declares', repo.patterns ?? [], gone.pattern),
    ...goneNameFindings('trigger', 'names', repo.kinds ?? [], gone.trigger),
  ];
}

/**
 * L01 for one scope (the app root or one side), over `files` (scope-relative). Both questions are answered by the
 * resolver's view of the edition: the names gone from it, and whether any slot of it still has tests. The declaration
 * findings are judged from the be side (its apps, patterns and kinds): the root scope looks at sides.be, a standalone
 * be-side check at its own view. `withDeclaration: false` (a side scope of a whole-app check) skips them: the root scope
 * already reported them on hfs.json, and the side scope would only repeat them on a path that is not this side's.
 */
export function editionFindings({ repoRoot, files, repo, resolver, withDeclaration = true }) {
  const gone = editionGone(resolver);
  const noTestWorld = resolver.slots().every((slot) => slot.tests === 'none');
  let beView = null;
  if (withDeclaration && repo.profile === 'app') beView = repo.sides?.be;
  else if (withDeclaration && repo.profile === 'be') beView = repo;
  const findings = beView ? declarationFindings(beView, gone) : [];
  for (const file of noTestWorld ? files : []) {
    if (file.includes('node_modules/')) continue;
    if (PACKAGE_JSON.test(file)) {
      findings.push(...packageFindings(repoRoot, file));
    } else if (TEST_TOOL_FILE.test(file) && resolver.classifyPath(file).status !== 'forbidden') {
      findings.push(found(HFS_EDITION_FORBIDDEN_PRESENT, file, `${file} is test tooling: the lite edition has no tests - the file belongs to the full edition`));
    }
  }
  return findings;
}
