// claim-file.mjs — an exclusive writer claim on one file: a lock file beside it names the claiming process, so two processes never rewrite the same file at once
// (the sealed secret writer, scripts/hfs/secret.mjs). The claim of a process that no longer exists is replaced.
import fs from 'node:fs';
import path from 'node:path';
import { pidAlive } from '../../lib/pid-alive.mjs';

const UNREADABLE_HELD_MS = 10_000;
const holderOf = (lock) => {
  try { const pid = JSON.parse(fs.readFileSync(lock, 'utf8')).pid; return Number.isInteger(pid) ? pid : null; } catch { return null; }
};
/** A lock a claimant created but has not yet written is held for a moment: only an old unreadable lock is a crashed claim. */
const freshlyCreated = (lock) => { try { return Date.now() - fs.statSync(lock).mtimeMs < UNREADABLE_HELD_MS; } catch { return false; } };

/** {ok: true, release} once this process holds the claim of `file`; {ok: false, holder} while a live process (this one included) holds it. `pid` is the claiming process. */
export function claimFile(file, { pid = process.pid } = {}) {
  const lock = path.join(path.dirname(file), `.${path.basename(file)}.lock`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      fs.writeFileSync(lock, JSON.stringify({ pid }), { flag: 'wx', mode: 0o600 });
      return { ok: true, release: () => { if (holderOf(lock) === pid) fs.rmSync(lock, { force: true }); } };
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const holder = holderOf(lock);
      if (holder !== null ? pidAlive(holder) : freshlyCreated(lock)) return { ok: false, holder };
      fs.rmSync(lock, { force: true });
    }
  }
  return { ok: false, holder: null };
}
