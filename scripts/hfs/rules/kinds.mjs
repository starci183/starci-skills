// kinds.mjs - the trigger kinds a back end uses are declared, whole and generated only when used (hfs.json sides.be.kinds).
//   BE_KIND_DECLARATION   `sides.be.kinds` lists exactly the kinds the features hold: a kind in use that is not declared, a declared kind with no
//                         feature, a declared kind whose patterns (ruleParams.be.kindPatterns) are not all in `sides.be.patterns`, and a declared
//                         kind whose platform capabilities (the tier-platform slots that name those patterns) are not tracked are each a finding;
//   BE_KIND_EMPTY         a kind folder `be/src/features/<kind>/` holds only instance folders `<kind>/<x>/`, and each instance holds source: a file
//                         directly in the kind folder (a `.gitkeep`) or an instance with no TypeScript file is a finding.
// A kind is a folder name of `be/src/features/` read from `triggerKinds` of the slot manifest (api features live in `features/api/<feature>/`);
// `features/cli/` is the one cli feature root (its module and group folders), so it is in use as soon as it holds a file.
import { loadSlotManifest, ruleParams } from '../slots.mjs';
import { found } from './read.mjs';

const KIND_DECLARATION = 'BE_KIND_DECLARATION';
const KIND_EMPTY = 'BE_KIND_EMPTY';

const FEATURES = 'be/src/features/';
const CLI = 'cli';

let memo;
/** The manifest facts the rules read: the trigger kinds, the patterns each kind needs, and the platform capability folders of each pattern. */
const facts = () => {
  if (memo) return memo;
  const manifest = loadSlotManifest();
  const platform = new Map();
  for (const slot of manifest.slots) {
    if (slot.pattern === undefined || slot.tier !== 'platform' || !slot.profiles.includes('be')) continue;
    const folder = /^src\/modules\/platform\/([a-z][a-z0-9-]*)\/$/.exec(slot.path);
    if (!folder) continue;
    if (!platform.has(slot.pattern)) platform.set(slot.pattern, []);
    platform.get(slot.pattern).push(folder[1]);
  }
  memo = { triggerKinds: manifest.triggerKinds ?? [], kindPatterns: ruleParams(manifest, 'be').kindPatterns, platform };
  return memo;
};

/** Findings of BE_KIND_DECLARATION and BE_KIND_EMPTY. */
export function kindFindings({ files, repo }) {
  const be = repo.sides?.be;
  if (!be) return [];
  const { triggerKinds, kindPatterns, platform } = facts();
  const kindFolders = new Set(triggerKinds);
  const findings = [];
  const instances = new Map();
  const sources = new Map();
  const roots = new Set();
  const tracked = new Set(files);
  for (const file of files) {
    if (!file.startsWith(FEATURES)) continue;
    const rest = file.slice(FEATURES.length).split('/');
    if (rest.length < 2) continue;
    const [first, second] = rest;
    if (!kindFolders.has(first)) continue;
    if (first === CLI) { roots.add(CLI); continue; }
    if (rest.length === 2) {
      findings.push(found(KIND_EMPTY, file, `${file} sits directly in the kind folder ${FEATURES}${first}/, which holds only instance folders (${first}/<name>/); an empty kind folder is never kept: run \`starci app add\` to create the first member.`, { kind: first }));
      continue;
    }
    if (!instances.has(first)) instances.set(first, new Set());
    instances.get(first).add(second);
    const key = `${first}/${second}`;
    sources.set(key, (sources.get(key) ?? 0) + (/\.[cm]?tsx?$/.test(file) ? 1 : 0));
  }
  for (const [key, count] of sources) {
    if (count === 0) findings.push(found(KIND_EMPTY, `${FEATURES}${key}/`, `${FEATURES}${key}/ holds no TypeScript source: a kind member without code is an empty folder; add its files with \`starci app add\` or remove the folder.`, { kind: key.split('/')[0] }));
  }
  const present = new Set([...instances.keys(), ...roots]);
  const declared = new Set(be.kinds ?? []);
  const patterns = new Set(be.patterns ?? []);
  for (const kind of [...present].sort()) {
    if (!declared.has(kind)) findings.push(found(KIND_DECLARATION, 'hfs.json', `hfs.json sides.be.kinds does not declare the kind \`${kind}\`, which ${FEATURES}${kind}/ uses; declare every kind in use (\`starci app add\` registers it).`, { kind }));
  }
  for (const kind of [...declared].sort()) {
    if (!present.has(kind)) {
      findings.push(found(KIND_DECLARATION, 'hfs.json', `hfs.json sides.be.kinds declares \`${kind}\` but no feature of that kind exists; a kind is declared only when it is used, so remove it or add its first member with \`starci app add\`.`, { kind }));
      continue;
    }
    for (const pattern of kindPatterns[kind] ?? []) {
      if (!patterns.has(pattern)) findings.push(found(KIND_DECLARATION, 'hfs.json', `the kind \`${kind}\` needs the pattern \`${pattern}\`, which hfs.json sides.be.patterns does not declare.`, { kind, pattern }));
      for (const capability of platform.get(pattern) ?? []) {
        if (!tracked.has(`be/src/modules/platform/${capability}/index.ts`)) findings.push(found(KIND_DECLARATION, `be/src/modules/platform/${capability}/`, `the kind \`${kind}\` needs the platform capability \`${capability}\` (pattern ${pattern}), which is not tracked at be/src/modules/platform/${capability}/; \`starci app add\` generates it with the first member of the kind.`, { kind, pattern, capability }));
      }
    }
  }
  return findings;
}
