// hfs-path-findings.mjs - the per-path judgements of the slot manifest: what a tracked path is. One function, two surfaces: `starci app check`
// (checkRepo) runs it over the tracked tree and keeps the findings that have no TypeScript file to sit on; the lint canon's project graph
// (scripts/hfs/project-graph.mjs) runs it over the same tree and serves the findings on a TypeScript file as ESLint reports.
//   HFS_SLOT_UNDECLARED / HFS_SLOT_AMBIGUOUS / HFS_SLOT_NOT_ENABLED / HFS_FORBIDDEN_PRESENT / HFS_TOOL_CONFIG_LOCAL / HFS_TRACKED_MUST_BE_IGNORED (R01, R16)
//   BE_SOURCE_FORM (R89, the file name), BE_SPEC_PLACEMENT (R102)
import path from 'node:path';
import { allowsFile } from './allows.mjs';
import { isFeTestPath } from './rules/fe-no-tests.mjs';
import { slotOwnsSecrets } from './rules/secrets.mjs';
import { specPlacementFindings } from './rules/spec-placement.mjs';
import { APP_SCOPE } from './slots.mjs';

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SOURCE_ROOT = /^(?:src|apps)\//;
const FREE_NAMES = new Set(['index.ts', 'main.ts']);
const PLAIN_ENTRY = /^<[a-z][a-z0-9-]*>.ts$/;
/**
 * Where the work of a banned data-access suffix goes. The suffix is banned by the manifest (ruleParams.be.bannedSuffixes);
 * this only adds the convention's home to the finding, so a file that is a repository or a store is told what replaces it.
 */
const DATA_ACCESS_HOME = 'SQL text is a constant in <name>.sql.ts of the capability persistence/ folder, and data access is the capability *.service.ts (or the application *.handler.ts) calling the shared EntityManager through its Inject<Conn>EntityManager()';
const BANNED_SUFFIX_HOME = Object.freeze({ repository: DATA_ACCESS_HOME, store: DATA_ACCESS_HOME });

/**
 * BE_SOURCE_FORM (R89): every tracked src/ or apps/ TypeScript file of a back end is index.ts, main.ts, a migration of
 * be.persistence, or <kebab-name>.<suffix>.ts with <suffix> in the closed vocabulary ruleParams.be.suffixes (a name such
 * as order.service.spec.ts keeps its inner words kebab-case). A suffix of ruleParams.be.bannedSuffixes anywhere in the
 * name is refused by name. Paths no slot owns are HFS_SLOT_UNDECLARED's, not this code's.
 */
function sourceFormFindings({ files, resolver }) {
  const { suffixes, bannedSuffixes } = resolver.ruleParams();
  // A suffix a slot names in its own file pattern (`*.builder.ts` of be.tests.fixtures.builders) is that slot's role: a file with it
  // anywhere else is refused, so a builder cannot live beside a service or in the fixtures root.
  const boundSuffixes = new Map();
  for (const slot of resolver.slots()) {
    const bound = /\*\.([a-z0-9-]+)\.ts$/.exec(slot.path ?? '')?.[1];
    if (bound && suffixes.includes(bound)) boundSuffixes.set(bound, slot);
  }
  const findings = [];
  for (const file of files) {
    if (!file.endsWith('.ts') || !SOURCE_ROOT.test(file)) continue;
    const c = resolver.classifyPath(file);
    if (c.status !== 'owned' || c.tracking === 'ignored') continue;
    const base = path.posix.basename(file);
    if (FREE_NAMES.has(base)) continue;
    // A literal file name the owning slot itself requires or allows (persistence/connection.ts, world/global-setup.ts) is its role.
    const slot = resolver.slot(c.slot);
    if ([...(slot?.requires ?? []), ...(slot?.allows ?? [])].some((entry) => entry === base)) continue;
    // So is an allows entry below the slot root whose last segment is that literal name (be.tests.world fakes/<provider>/server.ts).
    const admitted = allowsFile(resolver, file);
    if (admitted?.allowed && admitted.entry?.includes('/') && path.posix.basename(admitted.entry) === base) continue;
    // A slot whose `allows` holds a bare <name>.ts entry (be.tests.world.kit) names its files plainly, as platform/primitives does: kebab-case is the whole form.
    if (admitted?.allowed && PLAIN_ENTRY.test(admitted.entry ?? '') && KEBAB.test(base.slice(0, -'.ts'.length))) continue;
    if (c.slot === 'be.persistence' && path.posix.basename(path.posix.dirname(file)) === 'migrations') continue;
    const parts = base.slice(0, -'.ts'.length).split('.');
    const banned = parts.slice(1).find((part) => bannedSuffixes.includes(part));
    if (banned) {
      findings.push({ code: 'BE_SOURCE_FORM', level: 'error', path: file, suffix: banned, message: `${file}: the suffix .${banned} is banned; use a role from the closed suffix list (${suffixes.join(', ')})${BANNED_SUFFIX_HOME[banned] ? `. ${BANNED_SUFFIX_HOME[banned]}` : ''}` });
    } else if (boundSuffixes.has(parts.at(-1)) && parts.length >= 2 && boundSuffixes.get(parts.at(-1)).id !== c.slot) {
      findings.push({ code: 'BE_SOURCE_FORM', level: 'error', path: file, suffix: parts.at(-1), message: `${file}: the suffix .${parts.at(-1)}.ts belongs to ${boundSuffixes.get(parts.at(-1)).path} only; move the file there` });
    } else if (parts.length < 2 || !parts.every((part) => KEBAB.test(part)) || !suffixes.includes(parts.at(-1))) {
      findings.push({ code: 'BE_SOURCE_FORM', level: 'error', path: file, message: `${file}: the name must be <kebab-name>.<suffix>.ts with a suffix from the closed list (${suffixes.join(', ')}), or index.ts, main.ts or a migration` });
    }
  }
  return findings;
}

/** The findings of the slot manifest over `files` (repository-relative tracked paths) of a repository of `profile`. */
export function pathFindings({ files, resolver, profile }) {
  const findings = [];
  for (const file of files) {
    if (profile === 'fe' && isFeTestPath(file)) continue;   // a test path of a front end is FE_NO_TESTS's, the one finding of that file
    const c = resolver.classifyPath(file);
    if (c.status === 'no-slot') {
      findings.push({ code: 'HFS_SLOT_UNDECLARED', level: 'error', path: file, nearest: c.nearest, message: `${file} matches no slot${c.nearest ? `; nearest slot ${c.nearest.slot} (${c.nearest.pattern}), matched ${c.nearest.matchedPrefix || '.'} then expected ${c.nearest.expectedNext ?? 'nothing'}` : ''}` });
    } else if (c.status === 'ambiguous') {
      findings.push({ code: 'HFS_SLOT_AMBIGUOUS', level: 'error', path: file, candidates: c.candidates, message: `${file} is owned equally by ${c.candidates.map((x) => x.slot ?? x).join(', ')}` });
    } else if (c.status === 'not-enabled') {
      findings.push({ code: 'HFS_SLOT_NOT_ENABLED', level: 'error', path: file, slot: c.slot, message: `${file} belongs to ${c.slot}, an opt-in slot hfs.json neither lists in optionalSlots nor implies through an app kind` });
    } else if (c.status === 'forbidden') {
      const slot = resolver.slot(c.slot);
      if (slotOwnsSecrets(slot)) continue;   // the secret scan reports the file (R06): one finding per file
      const own = slot.rules?.includes('HFS_TOOL_CONFIG_LOCAL') ? 'HFS_TOOL_CONFIG_LOCAL' : 'HFS_FORBIDDEN_PRESENT';
      findings.push({ code: own, level: 'error', path: file, slot: c.slot, goesTo: c.goesTo, message: `${file} is tracked but ${c.slot} is forbidden in the tree${c.goesTo ? `; it belongs at ${c.goesTo}` : ''}` });
    } else if (c.tracking === 'ignored') {
      findings.push({ code: 'HFS_TRACKED_MUST_BE_IGNORED', level: 'error', path: file, slot: c.slot, message: `${file} is tracked but ${c.slot} must be gitignored` });
    }
  }

  if (profile === 'be') findings.push(...sourceFormFindings({ files, resolver }), ...specPlacementFindings({ files, resolver }));
  // The app root (scripts/, CI, hooks) holds no test layer: a spec there is the same finding as a spec of an operational script.
  else if (profile === APP_SCOPE) findings.push(...specPlacementFindings({ files, resolver }));
  // The lint canon's project graph serves these findings on a TypeScript file; the origin keeps them apart from the machine's.
  return findings.map((finding) => ({ ...finding, origin: 'repo' }));
}
