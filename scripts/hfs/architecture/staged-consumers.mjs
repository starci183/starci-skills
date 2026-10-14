import { catFile } from '../../api/git/cat-file.mjs';
import { diff } from '../../api/git/diff.mjs';
import { gitOutputOf } from '../../lib/git.mjs';

/** Eligible additions, copies, edits and rename destinations in the index, read in one blob batch. */
export function stagedConsumerSources(root, accept) {
  try {
    const options = { cwd: root, maxBuffer: 256 * 1024 * 1024 };
    const files = gitOutputOf(diff(['--cached', '--relative', '--name-only', '--diff-filter=ACMR', '-z', '--', '.'], options))
      .split('\0').filter(file => file && accept(file));
    if (!files.length) return [];
    // :./ keeps paths relative to this side's root even when git's top level is the parent app folder.
    // -z terminates requests with NUL; output headers and blob trailers still use LF.
    const bytes = gitOutputOf(catFile(['--batch', '-z'], {
      ...options, encoding: null, input: files.map(file => `:./${file}\0`).join(''),
    }));
    if (!Buffer.isBuffer(bytes)) return [];
    const sources = [];
    let cursor = 0;
    for (const file of files) {
      const end = bytes.indexOf(10, cursor);
      if (end < 0) return [];
      const header = /^[0-9a-f]+ blob (\d+)$/u.exec(bytes.subarray(cursor, end).toString('utf8'));
      if (!header) return []; // An index changed during the read: discard this supplement, keep disk consumers.
      const size = Number(header[1]);
      const start = end + 1;
      const next = start + size;
      if (!Number.isSafeInteger(size) || next >= bytes.length || bytes[next] !== 10) return [];
      sources.push({ file, text: bytes.subarray(start, next).toString('utf8') });
      cursor = next + 1;
    }
    return sources;
  } catch {
    // A non-git fixture (or an unavailable index) still uses the existing filesystem consumers.
    return [];
  }
}
