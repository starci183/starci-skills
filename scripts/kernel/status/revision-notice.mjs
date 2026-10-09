// revisionNotice — the `starci kernel status` field of what the last runtime revision change asks of this Kernel: its acked revision, whether the
// change concerns it and the files owed, in one line (scripts/machine/revision-notice.mjs). Null when the runtime revision is unknown.
import { noticeFor } from '../../machine/revision-ack.mjs';
import { kernelSeat } from '../../machine/revision-seats.mjs';
import { noticeLine } from '../../machine/revision-notice.mjs';
import { revRootOf } from '../runtime-rev.mjs';

const SHOWN = 12;

export default {
  key: 'revisionNotice',
  compute(ctx) {
    if (ctx.wf?.phase === 'finished' || ctx.wf?.archived_at) return null;
    const notice = noticeFor(kernelSeat({ ledger: ctx.ledger, workflowId: ctx.workflowId, root: revRootOf() }));
    if (notice.state === 'unknown-current') return null;
    return { ...notice, files: (notice.files ?? []).slice(0, SHOWN), replaceFiles: (notice.replaceFiles ?? []).slice(0, SHOWN), wording: undefined, line: noticeLine(notice) };
  },
  lines: (value) => [`REVISION ${value.line}`],
};
