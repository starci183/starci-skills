// rights-policy.mjs - R223 RIGHTS_ROLE_DENIED and R224 RIGHTS_PROTECTED_ZONE (knowledge/hfs/rules.yaml, gate runtime): the DATA the
// command guard and the PATH shim enforce is sound. The guard refuses by a table, so a typo in the table is a hole:
//   modules/kernel/command-policy.yaml  every refusal names a code of rule R223 (RIGHTS_GIT_PUSH, RIGHTS_GIT_TAG, RIGHTS_GIT_COMMIT,
//                                       RIGHTS_GIT_SYNC, RIGHTS_NPM_PUBLISH, RIGHTS_NPM_CI_UNLOCKED, RIGHTS_SUITE_RUN, RIGHTS_RELEASE_CUT,
//                                       RIGHTS_RAW_TOOL) and a non-empty `use` (the starci verb it sends the agent to); the bound roles are
//                                       roles the guard resolves; the runtime verbs include starci; every raw tool names its verb;
//   modules/kernel/protected-zone.yaml  the zones have unique ids and paths, and every protected catalog entry names a file that is
//                                       tracked and codes that failure-codes.yaml catalogues (RIGHTS_PROTECTED_ZONE and
//                                       RIGHTS_OP_RUNTIME_WRITE are the codes of the zone's refusals).
// Pure apart from ctx.read; a tree without the data files (a fixture) has nothing to judge.
import { parseYaml } from '../../../engine/yaml.mjs';

const POLICY_FILE = 'modules/kernel/command-policy.yaml';
const ZONE_FILE = 'modules/kernel/protected-zone.yaml';
const FAILURE_CODES_FILE = 'modules/kernel/failure-codes.yaml';
const R223_CODES = Object.freeze(['RIGHTS_ROLE_DENIED', 'RIGHTS_GIT_PUSH', 'RIGHTS_GIT_TAG', 'RIGHTS_GIT_COMMIT', 'RIGHTS_GIT_SYNC', 'RIGHTS_NPM_PUBLISH', 'RIGHTS_NPM_CI_UNLOCKED',
  'RIGHTS_SUITE_RUN', 'RIGHTS_RELEASE_CUT', 'RIGHTS_RAW_TOOL']);
const R224_CODES = Object.freeze(['RIGHTS_PROTECTED_ZONE', 'RIGHTS_OP_RUNTIME_WRITE', 'RIGHTS_OP_OUTSIDE_OWNED', 'RIGHTS_OP_CONTROL_PLANE']);
const BOUND_ROLES = Object.freeze(['op', 'lead', 'supervisor', 'coordinator', 'critic']);

const finding = (code, file, message) => ({ code, level: 'error', path: file, message: `${code} ${file}: ${message}` });
const parse = (text) => { try { const value = parseYaml(text); return value && typeof value === 'object' ? value : null; } catch { return null; } };

function entryFindings(where, entry, bad) {
  const found = [];
  if (typeof entry?.use !== 'string' || !entry.use.trim()) found.push(bad(`${where} names no \`use\`: a refusal must send the agent to a starci verb`));
  if (entry?.code !== undefined && !R223_CODES.includes(entry.code)) found.push(bad(`${where} names ${entry.code}, which is not a code of rule R223`));
  return found;
}

function policyEntryFindings(policy, bad) {
  const found = [];
  for (const section of [policy.git?.deny, policy.npm?.deny]) {
    for (const [name, entry] of Object.entries(section ?? {})) found.push(...entryFindings(`${name}`, entry, bad));
  }
  for (const [name, entry] of Object.entries(policy['raw-tools'] ?? {})) found.push(...entryFindings(`raw tool ${name}`, entry, bad));
  return found;
}

/** R223 findings of one parsed command policy. */
export function policyFindings({ file = POLICY_FILE, policy }) {
  const bad = (message) => finding('RIGHTS_ROLE_DENIED', file, message);
  if (!policy) return [bad('the table does not parse as a map')];
  const found = [];
  const bound = policy.roles?.bound;
  if (!Array.isArray(bound) || !bound.length || bound.some((r) => !BOUND_ROLES.includes(r))) found.push(bad(`roles.bound must list roles of ${BOUND_ROLES.join(', ')}`));
  if (!Array.isArray(policy.runtime) || !policy.runtime.includes('starci')) found.push(bad('runtime must list the starci program: the runtime verbs are the allowed path'));
  found.push(...policyEntryFindings(policy, bad));
  return found;
}

/** The findings of the declared zones: each has a unique string id and lists paths, and at least one is declared. */
function declaredZoneFindings(zone, bad) {
  const found = [];
  const seen = new Set();
  for (const entry of zone.zones ?? []) {
    if (typeof entry?.id !== 'string' || seen.has(entry.id)) found.push(bad(`zone ${entry?.id ?? '?'} has no id or repeats one`));
    seen.add(entry?.id);
    if (!Array.isArray(entry?.paths) || !entry.paths.length) found.push(bad(`zone ${entry?.id ?? '?'} lists no paths`));
  }
  if (!seen.size) found.push(bad('no zone is declared'));
  return found;
}

/** The findings of the protected catalog entries: a tracked file and catalogued codes. */
function catalogEntryFindings(zone, tracked, catalogued, bad) {
  const found = [];
  for (const entry of zone.catalogEntries ?? []) {
    if (!tracked(entry.file)) found.push(bad(`catalog entry file ${entry.file} is not a tracked file`));
    for (const code of entry.codes ?? []) if (!catalogued(code)) found.push(bad(`catalog entry code ${code} is not in ${FAILURE_CODES_FILE}`));
  }
  return found;
}

/** R224 findings of one parsed protected zone; `tracked(file)` and `catalogued(code)` are the tree's facts. */
export function zoneFindings({ file = ZONE_FILE, zone, tracked, catalogued }) {
  const bad = (message) => finding('RIGHTS_PROTECTED_ZONE', file, message);
  if (!zone) return [bad('the declaration does not parse as a map')];
  const found = [...declaredZoneFindings(zone, bad), ...catalogEntryFindings(zone, tracked, catalogued, bad)];
  for (const code of R224_CODES) if (!catalogued(code)) found.push(bad(`${code}, the refusal code of the zone, is not in ${FAILURE_CODES_FILE}`));
  return found;
}

/** R223 and R224 over the data files of the tree (ctx of scripts/hfs/runtime-check.mjs). */
export function rightsPolicyFindings(ctx) {
  const found = [];
  if (ctx.fileSet.has(POLICY_FILE)) found.push(...policyFindings({ policy: parse(ctx.read(POLICY_FILE) ?? '') }));
  if (ctx.fileSet.has(ZONE_FILE)) {
    const codes = ctx.read(FAILURE_CODES_FILE) ?? '';
    found.push(...zoneFindings({ zone: parse(ctx.read(ZONE_FILE) ?? ''), tracked: (f) => ctx.fileSet.has(f), catalogued: (c) => new RegExp(`^${c}:`, 'm').test(codes) }));
  }
  return found;
}
