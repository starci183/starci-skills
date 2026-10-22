// released-state.mjs - the git side of judging a loosening against the RELEASED state: a cached reader of files at a revision and the
// release boundary. Whether one finding loosens what the release shipped is the pure loosensReleased of scripts/lib/gate-loosening.mjs,
// specified by @starci/hfs (src/gate-loosening.spec.mjs) over its bundled copy.
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

/** The proven release boundary, including unknown history for the owning self-check. */
export const releaseCommit = (root) => releaseTagOf({ repo: root });
