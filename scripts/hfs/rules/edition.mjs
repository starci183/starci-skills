// edition.mjs - L01, the edition rule. An hfs.json edition is `full` or `lite` (absent means full); under lite the standard is a
// filter plus a few additions over the same manifest, never a second engine. Lite keeps the full code structure and swaps only
// backing infrastructure for Supabase (owner ruling 2026-10-13): the api and sidecars run on Swarm, with the same slots, patterns and unit specs behind the same
// ports, and no e2e or contract world. The slot layer already answers the paths lite removed (slots lite excludes, or whose
// litePresence is forbidden, come back HFS_FORBIDDEN_PRESENT with their goesTo); this rule reports what no path can state:
//   - inside a package.json: an e2e, contract, stack or browser script (`test:e2e`, `test:contract`, `test:stack`, `test:browser`,
//     with a pre/post prefix too) or a dependency of the infrastructure lite does not run - a test-world container or proxy
//     (testcontainers, toxiproxy) or a browser runner (playwright, cypress), and every library the lite infraOwners own nowhere
//     while full owns them (BullMQ, Kafka, Redis: lite runs pgmq and Postgres locks instead);
//   - a declaration of what lite does not have: an app kind, pattern or trigger kind every slot of which is forbidden under
//     lite. The forbidden names are DERIVED from the manifest, so adding or restoring a kind is a manifest edit, not an edit here
//     (under the 2026-10-13 ruling no pattern, trigger or app kind is gone).
// A full app answers []: the rule tests the edition once and a full view forbids none of these names.
import { found, readJson } from './read.mjs';
import { DEPENDENCY_SECTIONS } from './fe-no-tests.mjs';
import { editionRuleParams } from '../edition-slots.mjs';

export const HFS_EDITION_FORBIDDEN_PRESENT = 'HFS_EDITION_FORBIDDEN_PRESENT';

const PACKAGE_JSON = /(?:^|\/)package\.json$/;
/** The scripts of a test world lite does not have: e2e, contract, test-stack and browser journeys. Production Swarm deployment is legal. */
const LITE_FORBIDDEN_SCRIPT = /^(?:pre|post)?test:(?:e2e|contract|stack|browser)$/;
/** The dependencies of a test infrastructure lite does not run: containers, fault proxies and browser runners. */
const LITE_FORBIDDEN_TEST_INFRA = /^(?:testcontainers|@testcontainers\/.+|toxiproxy-node-client|playwright|playwright-core|@playwright\/.+|cypress)$/;

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

/**
 * The specifiers a lite back end may import nowhere although full gives them an owner: the self-hosted infrastructure libraries
 * the lite infraOwners override removes (bullmq, kafkajs, ioredis, ...). Read from the two rule-parameter views, never listed here.
 */
function liteRemovedLibraries(manifest) {
  const be = manifest?.ruleParams?.be;
  if (!be) return new Set();
  const lite = editionRuleParams(be, 'lite').infraOwners ?? {};
  const full = editionRuleParams(be, 'full').infraOwners ?? {};
  return new Set(Object.keys(lite).filter((name) => lite[name].length === 0 && (full[name]?.length ?? 0) > 0));
}

function scriptFindings(rel, pkg) {
  const scripts = isPlainObject(pkg.scripts) ? pkg.scripts : {};
  return Object.keys(scripts)
    .filter((name) => LITE_FORBIDDEN_SCRIPT.test(name))
    .map((name) => found(HFS_EDITION_FORBIDDEN_PRESENT, rel, `${rel} has script ${JSON.stringify(name)}: a lite app has unit specs and optional integration specs on the local Supabase stack, never an e2e, contract, stack or browser run`, { name }));
}

function dependencyFindings(rel, pkg, removed) {
  const findings = [];
  for (const section of DEPENDENCY_SECTIONS) {
    const deps = pkg[section];
    if (!isPlainObject(deps)) continue;
    for (const name of Object.keys(deps)) {
      if (LITE_FORBIDDEN_TEST_INFRA.test(name)) findings.push(found(HFS_EDITION_FORBIDDEN_PRESENT, rel, `${rel} ${section} has ${name}: a lite app runs no test containers, fault proxy or browser journey - its integration specs run against \`supabase start\``, { section, name }));
      else if (removed.has(name)) findings.push(found(HFS_EDITION_FORBIDDEN_PRESENT, rel, `${rel} ${section} has ${name}: lite replaces backing infrastructure with Supabase - the pattern's port is implemented on Supabase (pgmq, Postgres locks)`, { section, name }));
    }
  }
  return findings;
}

/** The findings one package.json's scripts and dependencies produce under lite. */
function packageFindings(repoRoot, rel, removed) {
  const pkg = readJson(repoRoot, rel);
  if (!isPlainObject(pkg)) return [];
  return [...scriptFindings(rel, pkg), ...dependencyFindings(rel, pkg, removed)];
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
 * L01 for one scope (the app root or one side), over `files` (scope-relative). The declaration findings are judged from the be
 * side (its apps, patterns and kinds): the root scope looks at sides.be, a standalone be-side check at its own view.
 * `withDeclaration: false` (a side scope of a whole-app check) skips them: the root scope already reported them on hfs.json.
 * The package findings read every package.json of the scope under lite.
 */
export function editionFindings({ repoRoot, files, repo, resolver, manifest, withDeclaration = true }) {
  if ((repo.edition ?? 'full') !== 'lite') return [];
  const gone = editionGone(resolver);
  let beView = null;
  if (withDeclaration && repo.profile === 'app') beView = repo.sides?.be;
  else if (withDeclaration && repo.profile === 'be') beView = repo;
  const findings = beView ? declarationFindings(beView, gone) : [];
  const removed = liteRemovedLibraries(manifest);
  for (const file of files) {
    if (file.includes('node_modules/') || !PACKAGE_JSON.test(file)) continue;
    findings.push(...packageFindings(repoRoot, file, removed));
  }
  return findings;
}
