// revision-ack.mjs — what the runtime and a seat do with a seat's notice (revision-notice.mjs): evaluate it, settle what concerns the seat
// nothing, record the one wake, plan the read manifest a seat is sent and attest it. A seat is the adapter of revision-seats.mjs:
// {role, root, current, records(), append(payload)}.
import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from '../../engine/digest.mjs';
import { NOTICE_SCHEMA, manifestHolds, noticeOf, readManifestOf, recordPayload } from './revision-notice.mjs';

/** The notice of a seat now. */
export const noticeFor = (seat) => noticeOf({ role: seat.role, root: seat.root, current: seat.current, records: seat.records() });

const SETTLES_BY_RUNTIME = new Set(['not-concerned', 'acked-legacy']);

/**
 * One runtime pass over a seat: the notice, and (when `repair`) the records the runtime itself owes. A change that concerns the seat
 * nothing is settled `not-concerned` with the diff hash; a Kernel whose own ack already read every file owed is settled `acked`; a seat
 * that meets its first revision adopts it as its baseline when `adopt`. Returns {notice, wrote: verdict|null}.
 */
export function runtimePass(seat, { repair = false, adopt = false } = {}) {
  const notice = noticeFor(seat);
  if (!repair) return { notice, wrote: null };
  if (SETTLES_BY_RUNTIME.has(notice.state)) {
    const verdict = notice.state === 'not-concerned' ? 'not-concerned' : 'acked';
    seat.append(recordPayload(notice, verdict));
    return { notice: { ...notice, state: 'current' }, wrote: verdict };
  }
  if (notice.state === 'no-baseline' && adopt) {
    seat.append(recordPayload({ role: seat.role, to: seat.current }, 'baseline'));
    return { notice: { role: seat.role, state: 'current', from: seat.current, to: seat.current }, wrote: 'baseline' };
  }
  return { notice, wrote: null };
}

/** The one wake of a revision was delivered: no second wake for the same revision. */
export const recordWoken = (seat, notice) => seat.append(recordPayload(notice, 'woken'));

/** A fresh seat took the place of the old one at the revision the seat now stands at: it read the tree at birth. */
export const recordReplaced = (seat, reason) => seat.append({ ...recordPayload({ role: seat.role, to: seat.current }, 'replaced'), reason: String(reason).slice(0, 120) });

const rowOfRoot = (root) => (file) => {
  const abs = path.join(root, file);
  try {
    const bytes = fs.readFileSync(abs);
    return fs.lstatSync(abs).isFile() ? { path: file, sha256: sha256(bytes), bytes: bytes.length } : null;
  } catch { return null; }
};

/** The manifest of the files the seat is owed for its current notice, derived from the bytes on disk now; null when nothing is owed. */
export function planRead(seat) {
  const notice = noticeFor(seat);
  if (notice.state !== 'owed' && notice.state !== 'owed-woken') return { notice, manifest: null };
  return { notice, manifest: readManifestOf(notice, rowOfRoot(seat.root)) };
}

/** Attest a manifest the seat read: it must equal the one derived now. Writes one `acked` record carrying the files it read (the event writer spills a long list). */
export function attest(seat, submitted) {
  const { notice, manifest } = planRead(seat);
  if (!manifest) throw Object.assign(new Error('no revision change is owed to this seat'), { code: 'revision-nothing-owed' });
  if (!manifestHolds(submitted, manifest)) throw Object.assign(new Error('the manifest is not the complete current read for this revision change'), { code: 'revision-read-unverified' });
  seat.append(recordPayload(notice, 'acked', { files: manifest.files }));
  return { notice, manifest };
}

export { NOTICE_SCHEMA };
