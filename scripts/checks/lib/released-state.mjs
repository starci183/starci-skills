// released-state.mjs - whether a loosening the gate-loosening self-check found is one against the RELEASED state.
// A commit is judged against its parent, but only what the last release shipped can be loosened: a check, a spec or an assertion that a
// lane added after the release and then folded into another before it shipped was never a gate of a release. So a finding stays only when
//   check-removed       the removed list item is an item of that gate file at the release commit
//   spec-deleted        the spec exists at the release commit
//   spec-skipped        the spec exists at the release commit
//   assertion-weakened  the spec exists at the release commit and holds fewer assertion lines now than it held there
import { show } from '../../api/git/show.mjs';
import { releaseTagOf } from '../../guards/release-definition.mjs';

const BUFFER = 64 * 1024 * 1024;

/** A reader of files at a revision of the repository at `cwd`: text, or null when the revision holds no such file. Cached. */
export function fileReader(cwd) {
  const cache = new Map();
  return (rev, file) => {
    const key = `${rev}:${file}`;
    if (!cache.has(key)) {
      const shown = show([key], { cwd, maxBuffer: BUFFER });
      cache.set(key, shown.status === 0 ? shown.stdout : null);
    }
    return cache.get(key);
  };
}

const assertionsIn = (text, markers) => String(text ?? '').split('\n').filter((line) => markers.some((marker) => line.includes(marker))).length;

/** The detail of a check-removed finding without its clipping mark: the start of the removed line. */
const shown = (detail) => (detail.endsWith('…') ? detail.slice(0, -1) : detail);

/** Whether `finding` loosens the state released at `base`, read through `read(rev, file)`; `rules` gives the assertion markers. */
export function loosensReleased(finding, { base, read, rules }) {
  const before = read(base, finding.file);
  if (before === null) return false;
  if (finding.kind === 'check-removed') return before.split('\n').some((line) => line.trim().startsWith(shown(finding.detail)));
  if (finding.kind !== 'assertion-weakened') return true;
  return assertionsIn(read('HEAD', finding.file), rules.assertionMarkers) < assertionsIn(before, rules.assertionMarkers);
}

/** The proven release boundary, including unknown history for the owning self-check. */
export const releaseCommit = (root) => releaseTagOf({ repo: root });
