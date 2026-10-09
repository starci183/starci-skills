// revision-deploy.mjs — what a deploy of the runtime tree says about each role, for the deploy event the deploying lane journals: per role the action
// and a count, never a list of files, so the event stays small and `starci debug digest` can print "revision X: Kernel re-read 1 file / replaced / not concerned".
import { changeScope } from '../machine/revision-change.mjs';
import { loadScope } from '../machine/revision-scope.mjs';
import { engineLoadedPredicate } from '../supervisor/engine-loaded.mjs';

const DEPLOY_SCHEMA = 'starci/revision-deploy@1';
const SHORT = 12;
const DEPLOY_ROLES = ['kernel', 'supervisor', 'op', 'critic', 'engine'];
const WORDS = Object.freeze({ none: 'not concerned', immediate: 'guards bite at once', admission: 'next attempt reads the new rules', restart: 'restart', reread: 'update in place', replace: 'replaced' });
const NAMES = Object.freeze({ kernel: 'Kernel', supervisor: 'Supervisor', op: 'Op', critic: 'Critic', engine: 'engine' });

/** The compact per-role payload of the change from `from` to `to`: {schema, from, to, known, digest, fileCount, roles: {role: {action, count}}, wording}. */
export function deployRoles(root, from, to, { doc = loadScope(root) } = {}) {
  const scope = changeScope(root, from, to, { doc, roles: DEPLOY_ROLES, engineLoaded: engineLoadedPredicate(root, doc) });
  const roles = Object.fromEntries(Object.entries(scope.roles).map(([role, r]) => [role, { action: r.action, count: r.count, ...(role === 'op' ? { kinds: r.kinds } : {}) }]));
  return { schema: DEPLOY_SCHEMA, from, to, known: scope.known, digest: scope.digest, fileCount: scope.fileCount, roles,
    wording: { declared: scope.wording.declared.length, accepted: scope.wording.accepted.length, refused: scope.wording.refused.length } };
}

const phrase = (role, entry) => {
  if (entry.action === 'reread') return `${NAMES[role]} re-read ${entry.count} file${entry.count === 1 ? '' : 's'}`;
  return `${NAMES[role]} ${WORDS[entry.action] ?? entry.action}`;
};

/** The one line the digest prints for a deploy payload. */
export function deployLine(payload) {
  const rev = String(payload.to).slice(0, SHORT);
  if (!payload.known) return `revision ${rev}: the change cannot be measured; every seat is replaced`;
  return `revision ${rev}: ${Object.entries(payload.roles).map(([role, entry]) => phrase(role, entry)).join(' / ')}`;
}
