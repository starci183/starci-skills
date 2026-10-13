// fe-stack.mjs - FE_STACK_FORBIDDEN: a front end depends only on the canonical library of each front-end concern (owner ruling
// 2026-10-13, lite = full). The catalog knowledge/hfs/fe-stack.yaml lists, per concern, the canonical packages and the alternatives
// it `forbids`; a manifest that declares a forbidden package is a finding naming the concern and its canonical packages.
//   - the fe side: every package.json of the side (the apps' and the packages' manifests), every dependency section;
//   - the app root: the one package.json carries both sides, so a forbidden package there is a finding unless the back end owns it
//     (a key of the be `infraOwners` rule parameter with an owner, e.g. graphql-ws or moment for platform/realtime and
//     platform/clock): a back-end library is not a front-end dependency.
// The import-level half (a forbidden package imported by a front-end source file) is the eslint canon's.
import fs from 'node:fs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { found, readJson } from './read.mjs';
import { DEPENDENCY_SECTIONS } from './fe-no-tests.mjs';
import { editionRuleParams } from '../edition-slots.mjs';

export const FE_STACK_FORBIDDEN = 'FE_STACK_FORBIDDEN';
const CATALOG_FILE = new URL('../../../knowledge/hfs/fe-stack.yaml', import.meta.url);
const PACKAGE_JSON = /(?:^|\/)package\.json$/;
const APP_ROOT_MANIFEST = 'package.json';

let forbidden = null;

/** name -> {concern, canonical} for every package a concern of the catalog forbids, read once. */
function forbiddenPackages() {
  if (forbidden) return forbidden;
  const catalog = parseYaml(fs.readFileSync(CATALOG_FILE, 'utf8'));
  if (catalog?.schema !== 'starci/fe-stack@1' || !Array.isArray(catalog.concerns)) throw new Error('knowledge/hfs/fe-stack.yaml is not a starci/fe-stack@1 catalog');
  forbidden = new Map();
  for (const concern of catalog.concerns) {
    for (const name of concern.forbids ?? []) forbidden.set(name, { concern: concern.id, canonical: concern.packages ?? [] });
  }
  return forbidden;
}

/**
 * The packages the back end owns (be infraOwners with at least one owner, full's view: a library lite removes is the edition rule's
 * finding, not a front-end one): a root dependency of the back end.
 */
function backendOwned(manifest) {
  const be = manifest?.ruleParams?.be;
  if (!be) return new Set();
  const owners = editionRuleParams(be, 'full').infraOwners ?? {};
  return new Set(Object.keys(owners).filter((name) => Array.isArray(owners[name]) && owners[name].length > 0));
}

function manifestFindings(repoRoot, rel, skip) {
  const pkg = readJson(repoRoot, rel);
  if (!pkg || typeof pkg !== 'object') return [];
  const catalog = forbiddenPackages();
  const findings = [];
  for (const section of DEPENDENCY_SECTIONS) {
    for (const name of Object.keys(pkg[section] ?? {})) {
      const entry = catalog.get(name);
      if (!entry || skip.has(name)) continue;
      const canonical = entry.canonical.length ? entry.canonical.join(', ') : 'the canonical library of the concern';
      findings.push(found(FE_STACK_FORBIDDEN, rel, `${rel} ${section} declares ${name}, which the front-end stack forbids for the ${entry.concern} concern (knowledge/hfs/fe-stack.yaml); use ${canonical} and delete ${name}`, { section, dependency: name, concern: entry.concern }));
    }
  }
  return findings;
}

/**
 * FE_STACK_FORBIDDEN over the tracked paths `files` of one scope: every package.json of the fe side, or the app root's one
 * package.json minus what the back end owns. A be side has no front-end manifest and answers [].
 */
export function feStackFindings({ repoRoot, files, repo, manifest }) {
  if (repo.profile === 'be') return [];
  const atRoot = repo.profile !== 'fe';
  const skip = atRoot ? backendOwned(manifest) : new Set();
  const manifests = files.filter((file) => !file.includes('node_modules/') && (atRoot ? file === APP_ROOT_MANIFEST : PACKAGE_JSON.test(file)));
  return manifests.flatMap((rel) => manifestFindings(repoRoot, rel, skip));
}
