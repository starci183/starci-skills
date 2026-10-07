// The text half of `starci kernel status` (verbs/status.mjs): one line per signal, in the same order the
// Kernel reads them.
import { OP_REV_DRIFT, shortRev } from '../../runtime-rev.mjs';
import { nameWithId } from '../../../lib/display-names.mjs';
import { shortWorkflow } from '../../dependency-graph.mjs';
import { stuckLine } from '../../../machine/op-metrics.mjs';

const headline = (s, out) => {
  const mark = s.actionable ? ' ACTIONABLE' : ' (no actionable work)';
  const jobs = Object.entries(s.byStatus).map(([status, n]) => `${status}:${n}`).join(',') || '-';
  const workers = s.workers.map((w) => `${w.jobId}:${w.liveness}`).join(',') || '-';
  return `${nameWithId(s.title, s.workflowId)} phase=${out.phase ?? '-'} frontier=${s.frontierState}${mark} jobs{${jobs}} failures{failed:${s.failures.failed},awaiting-owner:${s.failures.awaitingOwner}} leases=${s.leases.length} inbox-pending=${s.inboxPending} reports=${s.reports.length}(${s.unconsumedReports} unconsumed) workers=${workers}`;
};

const kernelLine = (s) => {
  const k = s.kernel;
  const at = k.launchedAt ? ` at ${k.launchedAt}` : '';
  const you = k.you ? ' — this is your terminal' : '';
  return `  kernel: attempt ${k.attempt} on ${k.terminal ?? '-'} (${k.launch ?? '-'} by ${k.launchedBy ?? '-'}${at})${you}`;
};

const kernelRevLine = (s) => {
  const k = s.kernelRev;
  let suffix = '';
  if (k.stale) {
    const scope = k.full ? 're-read kernel-prompt.md and driver-loop.yaml in full' : `${k.fileCount} file(s)`;
    suffix = ` STALE (${scope})`;
  } else if (k.unacked) suffix = ' (never acked)';
  return `  kernel rev: acked ${shortRev(k.acked) ?? 'none'} current ${shortRev(k.current) ?? '-'}${suffix}`;
};

const opRevLine = (w) => `  warn ${OP_REV_DRIFT}: ${w.jobId} (${w.op} a${w.attempt ?? '-'}) dispatched at ${shortRev(w.from)}, its op contract changed by ${shortRev(w.to)}: ${(w.files ?? []).slice(0, 5).join(', ')}`;

const runningRevLine = (w) => `  warn ${OP_REV_DRIFT} (running): ${w.jobId} (${w.op} a${w.attempt ?? '-'}) dispatched at ${shortRev(w.from)}, its op contract changed by ${shortRev(w.to)}: ${(w.files ?? []).slice(0, 5).join(', ')}; it is judged by its admission - starci kernel nudge --job ${w.jobId} carries the notice when its worker is idle`;

const outageLine = (c) => `  outage-circuit: ${c.provider} (${c.failureKind}) opened from ${c.jobId}'s screen (${c.match}) until ${c.expiresAt ? new Date(c.expiresAt).toISOString() : 'explicit recovery'}`;

const handoverLine = (s) => {
  const h = s.handover;
  const decision = h.ask?.decision ? ` ${h.ask.decision} by ${h.ask.answeredBy ?? '-'}` : '';
  const ask = h.ask ? ` ask ${h.ask.dispatchId} ${h.ask.state}${decision}` : '';
  const finish = h.finishAllowed ? ' — finish allowed' : ' — finish refused until the owner approves';
  return `  handover: ${h.state}${ask}${finish}`;
};

const kernelNotesLine = (s) => {
  const notes = s.kernelNotes.slice(-3).map((n) => `${n.kind} ${n.id} [${n.status}] ${n.headline}`).join(' | ');
  return `  kernel notes: ${notes}`;
};

const stuckSummaryLine = (s) => {
  const critical = s.stuckPast.filter((item) => item.severity === 'critical').length;
  return `  stuck: ${s.stuck.length} wait(s), ${s.stuckPast.length} past SLA (${critical} critical)`;
};

const legsLine = (s) => {
  const legs = s.graph.legs.map((leg) => {
    const deferred = leg.deferred ? '(deferred)' : '';
    return `${leg.op}(${leg.label}):${leg.color}${deferred}`;
  }).join(' ');
  return `  legs: ${legs}`;
};

const testsDeferredLines = (s) => {
  const t = s.testsDeferred;
  if (!t.jobs.length && !t.planned.length) return [];
  const off = t.off.length ? `owner config.yaml specs ${disabledSpecsText(t.off)}` : 'specs switches on';
  const items = [...t.jobs.map((item) => `${item.jobId} ${item.op} (${item.reason})`), ...t.planned.map((item) => `${item.op} planned (${item.reason})`)].join('; ');
  return [`  tests deferred (${off}; explicit-ask-only legs such as integration.verify wait for an ask): ${items} - starci kernel run-deferred-tests --workflow ${s.workflowId} [--kind unit|e2e|integration] runs them`];
};

const disabledSpecsText = (kinds) => kinds.map((kind) => `${kind}=false`).join(' ');

const workGraphLine = (s) => {
  const g = s.workGraph;
  const counts = Object.entries(g.counts).map(([color, n]) => `${color}:${n}`).join(' ');
  const runnable = g.frontier.map((node) => node.id).join(', ') || '-';
  return `  work graph v${g.version}: ${counts}; runnable ${runnable}`;
};

const drawReviewLine = (d) => {
  const shapes = d.shapes.map((shape) => {
    const notes = shape.openNotes.length ? ` notes ${shape.addressed}/${shape.openNotes.length} addressed` : '';
    return ` | ${shape.shape} ${shape.golden}${notes}`;
  }).join('');
  return `  draw-review: ${d.record} ${d.state} round ${d.rounds.length}${shapes}`;
};

const peerWaitLine = (wait) => {
  const holds = wait.holds.length ? ` holds ${wait.holds.join(', ')}` : '';
  const landed = wait.untilLanded ? ` until-landed ${wait.untilLanded}` : '';
  const until = `${wait.untilMessage ? ' until-message' : ''}${landed}`;
  return `  peer-wait: ${wait.incidentId} on ${wait.peer} (${wait.peerPhase})${holds}${until} — ${wait.detail.slice(0, 160)}`;
};

const heldSettleLine = (item) => {
  const release = item.worker === 'held' ? ` (release it: starci kernel reconcile --job ${item.jobId} --release-worker)` : '';
  return `  held-settle: ${item.jobId} (${item.opId ?? '-'} a${item.attempt}) ${item.heldBecause} ${item.blockedBy.incident} — report consumed, settle deferred behind the wait; worker ${item.worker}${release}`;
};

const waitResultText = (r) => {
  if (r.met) return `${r.condition} MET`;
  if (r.unmeetable) return `${r.condition} UNMEETABLE (${r.unmeetable})`;
  return `${r.condition} pending`;
};

// One supervisor-gate on the Supervisor ladder: who acts now, which step of how many, the deadline and what the runtime watches.
const gateLine = (gate) => {
  const watched = gate.condition ? gate.condition.map((entry) => `${entry.condition}${entry.met ? ' (met)' : ''}`).join(' AND ') : gate.conditionNote;
  return `  supervisor-gate: ${gate.incidentId} [${gate.cause}] holds ${gate.holds.join(', ')} - handler ${gate.handler}, step ${gate.step} of ${gate.steps}, deadline ${new Date(gate.deadlineAt).toISOString()}; watching: ${watched}`;
};
const openWaitLine = (item) => {
  const results = item.results.map(waitResultText).join(', ');
  return `  gate-conditions: ${item.incidentId} [${item.kind ?? '-'}] ${results}`;
};

const foundationLines = (s) => {
  const f = s.foundations;
  if (!f || !(f.owns.length || f.needs.length || f.detail)) return [];
  const owns = f.owns.map((x) => `${x.name}:${x.state}`).join(', ') || '-';
  const needs = f.needs.map((x) => {
    const owner = x.owner ? ` (${x.owner})` : '';
    return `${x.name}:${x.state}${owner}`;
  }).join(', ') || '-';
  const detail = f.detail ? ` — ${f.detail}` : '';
  return [`  foundations: owns ${owns}; needs ${needs}${detail}`];
};

const findingLine = (f) => `    ${f.kind}: ${f.summary.slice(0, 200)} -> supervisor ${f.action ?? '-'}${f.clearCut ? ' (clear-cut)' : ''}`;

const bridgeLine = (b) => {
  const provisional = b.provisional ? ' provisional' : '';
  const by = b.workflowId ? ` by ${b.workflowId}` : '';
  const foundation = b.foundation ? ` owning ${b.foundation}` : '';
  return `    bridge ${b.id} ${b.action} ${b.state ?? '-'}${provisional}${by}${foundation}: ${b.reason.slice(0, 160)}`;
};

const dependencyLines = (s) => {
  const d = s.dependencies;
  if (!d) return [];
  const waitsOn = d.waitsOn.map(shortWorkflow).join(', ') || '-';
  const waitedBy = d.waitedBy.map(shortWorkflow).join(', ') || '-';
  return [`  dependencies: waits on ${waitsOn}; waited on by ${waitedBy}`, ...d.findings.map(findingLine), ...d.bridges.map(bridgeLine)];
};

const cutSetLine = (set) => {
  const job = set.closingJob ? ` (${set.closingJob})` : '';
  const closing = set.closingOrdinal ? ` — the pass of ordinal ${set.closingOrdinal}${job} closes it and records ${set.closingCheck}` : '';
  return `  cut-set: ${set.op} ${set.id} passed ${set.passed.length}/${set.total}, open ${set.open.join(',')}${closing}`;
};

const queuedCausesLine = (s) => {
  const causes = Object.entries(s.queuedCauses).map(([cause, n]) => `${cause}:${n}`).join(',');
  return `queued{${causes}}`;
};

const queuedLine = (item) => {
  const detail = item.detail ? ` — ${item.detail}` : '';
  return `  ${item.jobId} (${item.opId ?? '-'}) ${item.queuedBecause}${detail}`;
};

const staleLine = (s, item) => {
  const held = item.heldBy ? ` (waits on seam ${item.heldBy})` : '';
  return `  ${s.internals.staleOperationLine(item)}${held}`;
};

/** The joined status text: every section in the order the Kernel reads them. */
export const statusText = (s, out) => [
  headline(s, out),
  ...(s.ramThrottle?.line ? [`  ${s.ramThrottle.line}`] : []),
  ...(s.kernel ? [kernelLine(s)] : []),
  ...(s.kernelRev ? [kernelRevLine(s)] : []),
  ...s.opRevDriftWarnings.map(opRevLine),
  ...s.runningRevDrift.map(runningRevLine),
  ...s.outageCircuits.map(outageLine),
  ...s.awaitingOwner.map((item) => `  ${item.jobId} (${item.opId} a${item.attempt}) awaiting-owner — ask ${item.dispatchId ?? '-'} ${item.answer}`),
  handoverLine(s),
  ...(s.frontier.reason ? [`  reason: ${s.frontier.reason}`] : []),
  ...(s.frontier.why ? [`  why: ${s.frontier.why.headline} -> ${s.frontier.why.next}`] : []),
  ...s.graph.legs.filter((leg) => leg.why).map((leg) => `  why ${leg.op}: ${leg.why.headline}`),
  ...(s.kernelNotes.length ? [kernelNotesLine(s)] : []),
  ...(s.stuck.length ? [stuckSummaryLine(s)] : []),
  ...s.stuckPast.slice(0, 8).map((item) => `    ${stuckLine(item)}`),
  ...(s.graph.legs.length ? [legsLine(s)] : []),
  ...testsDeferredLines(s),
  ...(s.workGraph ? [workGraphLine(s)] : []),
  ...s.graph.nextActions.map((action, index) => `  next ${index + 1}: ${s.internals.nextActionLabel(action)} — ${action.reason}`),
  ...(s.frontier.ownerGatesNotOwnerWork ?? []).map((g) => `  lint owner-gate-not-owner-work: ${g.incidentId} says "${g.marker}" - not the owner's step; a runtime defect goes to the supervisor as --kind source-runtime-defect (the gate only holds jobs), and it resolves --by kernel|supervisor`),
  ...s.logTypedMissing.slice(0, 5).map((w) => `  warn ${w.code}: ${w.jobId} (${w.op ?? '-'} a${w.attempt ?? '-'}) settled with ${w.opRows} op log row(s); missing ${w.missing.join(', ')}`),
  ...s.assetSlotsOwed.map((slot) => `  asset-slot-owed: ${slot.key} (${slot.opId ?? '-'} ${slot.jobId ?? '-'}, ${slot.html ?? '-'})${slot.requested ? '' : ' NO REQUEST'} - interface.asset fills it (src + data-asset-sha256)`),
  ...s.grammarProposals.map((p) => `  grammar-proposal: ${p.name} (${p.opId ?? '-'} ${p.jobId ?? '-'}, ${p.file ?? '-'}) proposed${p.complete ? '' : ' INCOMPLETE'} - the owner decides it through the draw-review ask; a grammar lane records grammar-proposal-resolved`),
  ...s.drawReviews.map(drawReviewLine),
  ...s.knowledgeChangeRequests.map((k) => {
    const target = k.target ? ` (${k.target})` : '';
    return `  knowledge-change-requested: ${k.noteId}${target} from ${k.record ?? '-'}: ${String(k.text).slice(0, 160)} - for the supervisor / runtime owner`;
  }),
  ...(s.frontier.ownerClaimsUnproven ?? []).map((c) => `  lint owner-claim-unproven: ${c.incidentId} (${c.kind ?? '-'}) resolved ${c.resolvedAt} claiming "${c.claim}" - ${c.reason}`),
  ...s.workerQuestions.map((item) => {
    const options = item.options?.length ? ` [${item.options.join(' | ')}]` : '';
    return `  worker-question: ${item.messageId} ${item.jobId} (${item.opId} a${item.attempt}): ${item.question}${options}`;
  }),
  ...s.peerMessages.map((message) => `  peer-message: ${message.key} from ${message.from} [${message.kind}] ${message.subject}`),
  ...s.peerWaits.map(peerWaitLine),
  ...s.heldSettle.map(heldSettleLine),
  ...s.askReserve.map((dispatchId) => `  ask-reserve: ${dispatchId} never reached the owner; park it: starci kernel serve-ask --repo <repo> --workflow ${s.workflowId} --dispatch ${dispatchId}`),
  ...s.askOnDemand.map((dispatchId) => `  ask-on-demand: ${dispatchId} is on Telegram; the owner generates its link (no form until then)`),
  ...s.typedWaits.resolved.map((item) => `  auto-resolved: ${item.incidentId} [${item.kind ?? '-'}] every typed condition holds — ${item.evidence.join('; ').slice(0, 240)}`),
  ...s.typedWaits.open.map(openWaitLine),
  ...(s.autopilotView?.view?.supervisorGates ?? []).map(gateLine),
  ...s.blockingOthers.map((item) => `  blocking-others: ${item.jobId} (${item.opId ?? '-'} ${item.status}) — ${item.workflows.length} workflow(s) wait on it for ${item.waitedMinutes}m (${item.workflows.join(', ')}); weight ${item.weight}`),
  ...(s.queued.length ? [queuedCausesLine(s)] : []),
  ...s.queued.map(queuedLine),
  ...s.staleOperations.map((item) => staleLine(s, item)),
  ...s.internals.sourceDriftLines(s.sourceDrift, '  '),
  ...s.internals.peerDriftLines(s.peerDrift, '  '),
  ...foundationLines(s),
  ...dependencyLines(s),
  ...s.cutSets.map(cutSetLine),
].join('\n');
