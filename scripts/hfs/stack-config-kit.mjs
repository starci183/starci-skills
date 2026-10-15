// stack-config-kit.mjs - the small validators the deploy block (stack-deploy-config.mjs) and its ingress block (stack-ingress-config.mjs)
// share: a problem collector, closed field lists, pattern checks and the environment-relative file check.
import path from 'node:path';
import { isPlainObject as plain } from '../../engine/plain-object.mjs';

const BACKSLASH = String.fromCodePoint(92);

/** Collects problems with the path they concern; `problem(at, message)` is the only way to add one. */
export function collector() {
  const problems = [];
  return { problems, problem: (at, message) => { problems.push({ at, message }); } };
}

/** True for a mapping; reports every key outside `allowed` as "not a field of the <label> block". */
export function closedFields(c, at, value, allowed, label = 'deploy') {
  if (!plain(value)) { c.problem(at, 'must be a mapping'); return false; }
  for (const key of Object.keys(value)) if (!allowed.includes(key)) c.problem(`${at}.${key}`, `is not a field of the ${label} block`);
  return true;
}

/** True when `value` is a string matching `pattern`; otherwise reports it. */
export function patternField(c, at, value, pattern) {
  if (typeof value !== 'string' || !pattern.test(value)) { c.problem(at, `must match ${pattern}`); return false; }
  return true;
}

/** A path inside .starcistacks/<env>/ : relative, forward slashes, no `..`, and present in the tree. */
export function treeFile(c, at, value, probe) {
  if (typeof value !== 'string' || value === '' || path.posix.isAbsolute(value) || value.includes(BACKSLASH) || path.posix.normalize(value).split('/').includes('..')) {
    c.problem(at, 'must be a relative path inside the environment directory');
    return;
  }
  if (!probe.exists(value)) c.problem(at, `${value} does not exist under the environment directory`);
}
