// revision-notice.mjs — what one long-lived seat (a Kernel, the Supervisor) owes for a change of the runtime tree, read from the records it left.
//
// A seat settles a revision change by exactly one of: a `not-concerned` record the runtime writes itself (the change touched nothing of the
// seat's declared scope, modules/kernel/revision-scope.yaml), an `acked` record the seat writes after reading the files it was sent, a
// `replaced` record the runtime writes when a fresh seat took its place, or a `baseline` record that adopts the revision a seat first meets.
// The next change is measured from the newest settled revision, so several commits deployed together are ONE change, and a seat is woken at
// most once per revision it has not settled (a `woken` record). No record carries a file list: it carries the two revisions, a count and the
// diff hash; the list lives in the blob store (`filesSha`), which keeps every record far under the event payload limit however many files.
import { sha256 } from '../../engine/digest.mjs';
import { changeScope } from './revision-change.mjs';

export const NOTICE_EVENT = 'runtime-rev-noticed';
export const NOTICE_SCHEMA = 'starci/revision-notice@1';
export const READ_SCHEMA = 'starci/revision-read@1';
/** The verdicts that settle a revision for a seat; `woken` only marks that the one wake of a revision was delivered. */
export const SETTLED_VERDICTS = Object.freeze(['not-concerned', 'acked', 'replaced', 'baseline']);
const OWED = new Set(['reread', 'replace']);
const memo = new Map();

const scopeOf = (root, from, to, role) => {
  const key = `${root}\0${from}\0${to}\0${role}`;
  if (!memo.has(key)) memo.set(key, changeScope(root, from, to, { roles: [role] }));
  return memo.get(key);
};

/** The newest settled revision, the revisions already woken for, and the newest legacy Kernel ack ({rev, files}); `records` are oldest first. */
function foldRecords(records) {
  let baseline = null, legacy = null;
  const woken = new Set();
  for (const record of records) {
    if (record.type === 'settled') baseline = record.rev;
    else if (record.type === 'woken') woken.add(record.rev);
    else if (record.type === 'legacy-ack') legacy = { rev: record.rev, files: new Set(record.files) };
  }
  return { baseline: baseline ?? legacy?.rev ?? null, woken, legacy };
}

const owedNotice = ({ role, scope, mine, from, to, woken, legacy }) => {
  const covered = legacy?.rev === to && mine.action === 'reread' && mine.files.every((file) => legacy.files.has(file));
  const base = { role, from, to, action: mine.action, count: mine.count, digest: scope.digest, files: mine.files, replaceFiles: mine.replaceFiles, wording: scope.wording };
  if (covered) return { ...base, state: 'acked-legacy' };
  if (mine.action === 'replace') return { ...base, state: 'replace-due' };
  return { ...base, state: woken.has(to) ? 'owed-woken' : 'owed' };
};

/**
 * The notice of `role` for the runtime at `root` standing at `current`, from the seat's `records`
 * ([{type: 'settled'|'woken'|'legacy-ack', rev, files?}], oldest first). `state` is one of: unknown-current, no-baseline, current,
 * not-concerned (write the record, nothing is owed), acked-legacy (the Kernel's own ack already covers every file owed), owed (wake once),
 * owed-woken (already woken for this revision), replace-due (replace the seat at its next yield).
 */
export function noticeOf({ role, root, current, records, scopeFor = scopeOf }) {
  if (!current) return { role, state: 'unknown-current' };
  const { baseline, woken, legacy } = foldRecords(records);
  if (!baseline) return { role, state: 'no-baseline', to: current };
  if (baseline === current) return { role, state: 'current', from: baseline, to: current };
  const scope = scopeFor(root, baseline, current, role);
  const mine = scope.known ? scope.roles[role] : { action: 'replace', count: 0, files: [], replaceFiles: [] };
  if (!OWED.has(mine.action)) return { role, state: 'not-concerned', from: baseline, to: current, action: mine.action, count: scope.fileCount, digest: scope.digest, files: [], replaceFiles: [] };
  return owedNotice({ role, scope, mine, from: baseline, to: current, woken, legacy });
}

/** The small payload of a settling or waking record: revisions, verdict, counts and hashes, never a list of files. */
export function recordPayload(notice, verdict, { filesSha = null } = {}) {
  return { schema: NOTICE_SCHEMA, role: notice.role, from: notice.from ?? null, to: notice.to, verdict, action: notice.action ?? null, count: notice.count ?? 0,
    digest: notice.digest ?? null, filesSha };
}

/** The one-line status of a seat's notice: revision acked, concerned or not, files owed. */
export function noticeLine(notice, short = (rev) => String(rev ?? '').slice(0, 12)) {
  const rev = short(notice.to ?? notice.from);
  const owed = { owed: 'owes', 'owed-woken': 'owes (woken)', 'replace-due': 'is due for replacement' }[notice.state];
  if (owed) return `${notice.role} ${owed} ${notice.action === 'replace' ? `${notice.replaceFiles.length} changed rule file(s)` : `${notice.files.length} file(s)`} of rev ${rev}`;
  const label = { current: 'acked rev', 'not-concerned': 'not concerned by rev', 'acked-legacy': 'acked rev', 'no-baseline': 'has no baseline at rev', 'unknown-current': 'rev unknown' }[notice.state] ?? notice.state;
  return `${notice.role} ${label} ${rev}`;
}

/** The files a seat is sent for the revision: its notice files that still exist, each with hash and size, plus those removed; with the digest that binds them. */
export function readManifestOf(notice, rowOf) {
  const rows = [], removed = [];
  for (const file of notice.files) {
    const row = rowOf(file);
    if (row) rows.push(row); else removed.push(file);
  }
  const body = { schema: READ_SCHEMA, role: notice.role, from: notice.from, to: notice.to, files: rows, removed };
  return { ...body, digest: sha256(JSON.stringify(body)) };
}

/** Whether a manifest the seat submits equals the one the runtime derives now, file by file and byte by byte. */
export function manifestHolds(submitted, required) {
  return Boolean(submitted) && submitted.digest === required.digest && submitted.schema === required.schema
    && JSON.stringify({ ...submitted, digest: undefined }) === JSON.stringify({ ...required, digest: undefined });
}

const NAMED = 3;
/** The short sentence a wake carries for an owed notice: the revision, how many files and the first few names, and the verb that lists and attests them. Empty for any other state. */
export function noticeWakeLine(notice, command, short = (rev) => String(rev ?? '').slice(0, 12)) {
  if (notice?.state !== 'owed') return '';
  const names = notice.files.slice(0, NAMED).join(', ');
  const more = notice.files.length > NAMED ? ` and ${notice.files.length - NAMED} more` : '';
  return `Runtime rev ${short(notice.to)} changed ${notice.files.length} file(s) of your contract (${names}${more}): ${command} --plan lists them with hashes; read them, then attest. Nothing else is asked.`;
}
