// kernel-notice.mjs — what the runtime revision asks of ONE Kernel, read once and projected to every surface that speaks of it: the status field `revisionNotice`, the menu item
// rev-ack, the re-read next action and the sentence a wake carries. The decider is the notice (scripts/machine/revision-notice.mjs) over the table
// modules/kernel/revision-scope.yaml; nothing here decides which files a Kernel owes.
import { noticeFor } from '../machine/revision-ack.mjs';
import { kernelSeat } from '../machine/revision-seats.mjs';
import { noticeLine, noticeWakeLine } from '../machine/revision-notice.mjs';
import { landKernelNotes, shortRev } from './runtime-rev.mjs';

const SHOWN = 12;

/** Whether the Kernel itself owes a re-read: the notice is owed (woken or not). A replacement is the runtime's, a settled revision owes nothing. */
export const noticeOwes = (notice) => notice?.state === 'owed' || notice?.state === 'owed-woken';

/** The status field of workflow `workflowId` over `db`: the notice with its first files and its one line; null when the runtime revision is unknown. */
export function kernelNoticeOf(db, workflowId, { root }) {
  const notice = noticeFor(kernelSeat({ ledger: { db }, workflowId, root }));
  if (notice.state === 'unknown-current') return null;
  return { ...notice, files: (notice.files ?? []).slice(0, SHOWN), replaceFiles: (notice.replaceFiles ?? []).slice(0, SHOWN), wording: undefined, line: noticeLine(notice) };
}

/** What the lands since the settled revision say a Kernel must do differently, verbatim; empty when no land carried a note. */
const noteSentence = (notes) => (notes.length ? ` What a Kernel must do differently: ${notes.join(' | ')}` : '');

/**
 * The one sentence a Kernel wake carries about the runtime revision (no newline): the owed files while the notice is owed (once per set of files), the bare revision otherwise;
 * the notes of the lands ride it until the revision is settled. null without a known revision.
 */
export function revisionWakeLine(notice, workflowId, { root, landNotes = landKernelNotes } = {}) {
  if (!notice?.to) return null;
  const owed = noticeWakeLine(notice, `starci kernel revision-ack --workflow ${workflowId}`);
  const notes = notice.from && notice.from !== notice.to && notice.state !== 'current' ? landNotes(root, notice.from, notice.to) : [];
  const head = owed || `Runtime rev ${shortRev(notice.to)}.`;
  return `${head}${noteSentence(notes)}`;
}
