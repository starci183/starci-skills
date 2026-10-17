// diff-base.mjs - the base `starci runtime verify` diffs against, and why it was chosen.
// A local `main` is only a branch name: in a shared repository it can sit far behind origin/main and behind the newest release tag (nothing moves it
// between releases), and a base that old makes the affected set several times larger than the change. So with no named ref the base is the merge-base of
// HEAD with the NEWEST of local main, origin/main and the latest release tag reachable from HEAD: a candidate whose merge-base contains the merge-base of
// an older one wins, and the answer says which candidate it passed over.
import { isAncestor } from '../api/git/is-ancestor.mjs';
import { mergeBase } from '../api/git/merge-base.mjs';
import { tag as gitTag } from '../api/git/tag.mjs';

const SHORT = 9;
const short = (sha) => String(sha).slice(0, SHORT);

/** The newest release tag (v*) reachable from HEAD, by tag date, or null when there is none. */
function latestReleaseTag(root) {
  const listed = gitTag(['--list', 'v[0-9]*', '--merged', 'HEAD', '--sort=-creatordate'], { cwd: root, timeout: 60_000 });
  return listed.status === 0 ? String(listed.stdout ?? '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null : null;
}

/** The explicit-ref answer: the merge-base with the named ref, or an unresolved one. */
function named(root, ref, mergeBaseOf) {
  const base = mergeBaseOf(root, 'HEAD', ref) ?? null;
  return base ? { base, ref, why: `named by --base ${ref}` } : { base: null, ref, why: `${ref} has no merge base with HEAD` };
}

/**
 * The diff base: {base, ref, why}. base is the merge-base sha (null when nothing resolves), ref the candidate it came from, why a sentence naming the candidates it passed over.
 * deps (seams of a spec): mergeBase(root, a, b), isAncestor(root, a, b), latestTag(root).
 */
export function baseChoice(root, ref, deps = {}) {
  const mergeBaseOf = deps.mergeBase ?? mergeBase;
  if (ref) return named(root, ref, mergeBaseOf);
  const ancestorOf = deps.isAncestor ?? isAncestor;
  const tagName = (deps.latestTag ?? latestReleaseTag)(root);
  const candidates = ['main', 'origin/main', ...(tagName ? [tagName] : [])];
  let best = null;
  const passedOver = [];
  for (const candidate of candidates) {
    const base = mergeBaseOf(root, 'HEAD', candidate);
    if (!base || base === best?.base) continue;
    if (!best) { best = { ref: candidate, base }; continue; }
    if (ancestorOf(root, best.base, base)) { passedOver.push(`${best.ref} (${short(best.base)})`); best = { ref: candidate, base }; }
  }
  if (!best) return { base: null, ref: null, why: `none of ${candidates.join(', ')} has a merge base with HEAD` };
  const behind = passedOver.length ? `; ${passedOver.join(', ')} is behind it` : '';
  return { base: best.base, ref: best.ref, why: `newest merge base of ${candidates.join(', ')} with HEAD is ${best.ref}${behind}` };
}

/** The first line of an answer: the base and why. */
export const baseLine = (choice) => `base: ${choice.base ? short(choice.base) : 'none'} (${choice.why})`;
