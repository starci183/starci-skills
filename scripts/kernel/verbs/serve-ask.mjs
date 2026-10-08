// starci kernel serve-ask — park an owner ask. A StarCi Next Kernel held an ask-reserve for an hour
// (inc-2558dd227dfd) because it could mutate only through cli.mjs, so this verb is the Kernel's
// one way to put a question in front of the owner. Owner, 2026-09-24: a form URL is served only
// when the owner asks for it. So with Telegram ready this verb serves NOTHING: parkAsk
// (serve-ask.mjs) supersedes the asks it replaces, sends the owner an approval ask with a
// "Generate URL" button (a credential ask is only listed, for /creds) and records `ask-notified`;
// the Telegram bridge serves the form (scripts/kernel/ask-server.mjs --on-demand telegram) when
// the button is pressed. `--now` also launches the form at once (local use), and with Telegram
// off or unreachable the form is launched at once as before, since nothing else could ever serve
// it. An ask config.yaml asks.autoAcceptRecommended answers (serve-ask.mjs autoAcceptAsk) is
// answered here instead, in-process, so the calling Kernel reads the answer in this verb's own
// output and nothing is served. Split out of cli.mjs (lane slim-api); its help line stays in
// cli.mjs usage() (usageInCore).
//
//   serve-ask --workflow <id> [--dispatch <id>] [--ttl <ms>] [--now]
import path from 'node:path';
import { spawnNode } from '../../api/node/spawn-node.mjs';
import { skillRoot } from '../../../engine/runtime-root.mjs';
import { ledgerFileFor } from '../../../engine/db/ledger.mjs';
import { ensureAskConnectors as ensureConnectors, publicBase } from '../../connectors/tunnel.mjs';
import { getWorkflow } from './shared/rows.mjs';
import { AUTOPILOT_BY, PROVISIONAL_LABEL, autopilotAnswerAsk } from '../autopilot-run.mjs';
import { autoAcceptAsk, closeAskMessages, parkAsk, supersedeEarlierAsks } from '../ask-server.mjs';
import { wakeKernelForTransition } from '../wake-delivery.mjs';

function ensureAskConnectors() {
  const result = ensureConnectors();
  if (result.skipped) return null;
  return {
    gateway: result.ok === true && Boolean(result.gateway),
    tunnel: result.ok === true && Boolean(result.tunnel),
    publicBase: result.ok === true ? publicBase() : null,
    ...(result.ok === false ? { error: result.error } : {}),
  };
}

function answerWithAutopilot({ ledger, repo, workflowId, report, emit, args }) {
  const pilot = autopilotAnswerAsk({ ledger, repo, workflowId, report,
    wake: (l, o) => wakeKernelForTransition(l, { workflowId: o.workflowId, transition: 'ask-answered', ids: { dispatchId: o.dispatchId }, lines: [
      `autopilot answered ask ${o.dispatchId} (answeredBy autopilot); receipt ${o.receiptPath}.`, 'The runtime re-runs the asking op with the receipt; read starci kernel status for what waits on you.'] }) });
  if (!pilot.handled) return false;
  const out = { ok: true, workflowId, dispatchId: report.dispatch_id, autopilot: true, action: pilot.action, class: pilot.class, ...(pilot.receiptPath ? { receiptPath: pilot.receiptPath } : {}),
    ...(pilot.stubPath ? { stubPath: pilot.stubPath, owed: pilot.owed } : {}), ...(pilot.findings ? { findings: pilot.findings.slice(0, 20) } : {}) };
  let message;
  if (pilot.action === 'deferred-to-handover') {
    const stubPath = pilot.stubPath ?? 'the stub path';
    message = `ask ${report.dispatch_id} deferred to handover by autopilot (${pilot.class}): nothing is sent to the owner; proceed on ${stubPath}; owed at handover: ${pilot.owed ?? '-'}`;
  } else {
    const provisional = pilot.action === 'provisional' ? `, ${PROVISIONAL_LABEL}` : '';
    message = `ask ${report.dispatch_id} answered by autopilot (${pilot.action}, answeredBy ${AUTOPILOT_BY}${provisional}): re-enqueue ${report.op_id} --retry-of its job so it applies receipt ${pilot.receiptPath}`;
  }
  emit(out, message, args.json);
  return true;
}

async function answerWithConfig({ ledger, repo, workflowId, report, emit, args }) {
  const auto = await autoAcceptAsk({ ledger, ledgerFile: ledgerFileFor(repo), repo, workflowId, report });
  if (!auto.accepted) return false;
  const superseded = supersedeEarlierAsks(ledger, workflowId, report);
  await closeAskMessages(ledger, { ledgerFile: ledgerFileFor(repo), workflowId, dispatchIds: superseded, reason: 'retired' });
  const telegram = auto.telegram?.sent ? 'sent' : (auto.telegram?.skipped ?? auto.telegram?.error ?? null);
  const out = { ok: true, workflowId, dispatchId: report.dispatch_id, autoAccepted: true, optionIndex: auto.optionIndex, option: auto.option, answeredBy: auto.answeredBy, receiptPath: auto.receiptPath, wake: auto.wake?.action ?? null, telegram };
  emit(out, `ask ${report.dispatch_id} auto-accepted by config.yaml asks.autoAcceptRecommended: option ${auto.optionIndex + 1} (${auto.option}), answeredBy ${auto.answeredBy}; no form served. It binds like an owner answer for this business choice: re-enqueue the op with the answer bound (receipt ${auto.receiptPath}); a later owner answer supersedes it`, args.json);
  return true;
}

/** Tells the Kernel the ask is parked on Telegram (a credential ask is only listed); no form is served. */
function emitParkedAsk({ parked, notice, workflowId, report, emit, args }) {
  const out = { ok: true, workflowId, dispatchId: report.dispatch_id, onDemand: true, askClass: parked.askClass, telegram: notice, superseded: parked.superseded, pid: null, servedBy: null };
  let where;
  if (parked.askClass === 'credential') {
    where = 'a credential ask: listed in the owner\'s Telegram /creds, never pushed; it holds only the live-proof legs, so keep driving every other approved leg';
  } else {
    const delivery = notice.fresh ? 'sent now' : 'already in the chat';
    where = `the owner has it on Telegram with a Generate URL button (${delivery})`;
  }
  emit(out, `ask ${report.dispatch_id} parked: ${where}; no form is served until the owner asks for one. The answer's ask-answered wakes you`, args.json);
}

async function serveOwnerAsk({ ledger, args, repo, emit, workflowId, dispatchId, report }) {
  const parked = report ? await parkAsk({ ledger, ledgerFile: ledgerFileFor(repo), repo, workflowId, report }) : null;
  const notice = parked?.notified ? { notified: true, messageId: parked.telegram?.messageId ?? null, fresh: Boolean(parked.telegram?.sent) } : null;
  if (parked?.notified && args.now !== true) {
    emitParkedAsk({ parked, notice, workflowId, report, emit, args });
    return;
  }
  // Served now: --now (local use), or Telegram is off / unreachable so nothing else could serve it.
  const connectors = parked?.notified ? null : ensureAskConnectors();
  const script = path.join(skillRoot, 'scripts', 'kernel', 'ask-server-main.mjs');
  const argv = [script, '--repo', repo, '--workflow', workflowId, ...(dispatchId ? ['--dispatch', dispatchId] : []), ...(args.ttl ? ['--ttl', String(args.ttl)] : [])];
  const child = spawnNode(argv, { detached: true, stdio: 'ignore', cwd: skillRoot });
  child.unref();
  let why = null;
  if (parked) why = parked.notified ? 'now' : `telegram: ${parked.telegram?.skipped ?? parked.telegram?.error ?? 'not sent'}`;
  const out = { ok: true, workflowId, dispatchId, pid: child.pid ?? null, servedBy: 'scripts/kernel/ask-server.mjs', onDemand: false, ...(notice ? { telegram: notice } : {}), ...(why ? { servedBecause: why } : {}), ...(connectors ? { connectors } : {}) };
  const dispatchNote = dispatchId ? ` dispatch ${dispatchId}` : '';
  const whyNote = why ? `, ${why}` : '';
  emit(out, `serve-ask launched for ${workflowId}${dispatchNote} (pid ${out.pid}${whyNote}); status shows ask-serving once the form binds`, args.json);
}

/** The newest ask report of the workflow (of one dispatch when named), joined with its attempt, or undefined. */
const latestAskReport = (db, workflowId, dispatchId) => db.prepare(`SELECT r.*, a.op_id, a.try_no AS attempt FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id WHERE r.workflow_id=? AND r.outcome='ask' ${dispatchId ? 'AND r.dispatch_id=?' : ''} ORDER BY r.report_id DESC LIMIT 1`)
  .get(...(dispatchId ? [workflowId, dispatchId] : [workflowId]));

export default {
  verb: 'serve-ask',
  required: ['workflow'],
  kernelOnly: true,
  usageInCore: true,
  usage: '  serve-ask --workflow <id> [--dispatch <id>] [--ttl <ms>] [--now]   park an owner ask (serve-ask.mjs): Telegram notice first, form on demand',
  async run({ ledger, args, repo, emit }) {
    const db = ledger.db, workflowId = args.workflow;
    if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    const dispatchId = args.dispatch ?? null;
    if (dispatchId && !db.prepare("SELECT 1 FROM reports WHERE workflow_id=? AND dispatch_id=? AND outcome='ask' LIMIT 1").get(workflowId, dispatchId)) {
      throw Object.assign(new Error(`dispatch ${dispatchId} filed no ask report in ${workflowId}`), { code: 'ask-unknown' });
    }
    const report = latestAskReport(db, workflowId, dispatchId);
    const answered = report && db.prepare("SELECT 1 FROM events WHERE workflow_id=? AND kind='ask-answered' AND json_extract(payload_json,'$.dispatchId')=? LIMIT 1").get(workflowId, report.dispatch_id);
    const openAsk = report && !answered ? report : null;
    // Autopilot (owner ruling 2026-09-28): the ask is answered provisionally or deferred to handover - never sent to the
    // owner - unless it is the owner's own end-of-flow step (the handover, its credential checklist).
    if (openAsk && (answerWithAutopilot({ ledger, repo, workflowId, report, emit, args })
      || await answerWithConfig({ ledger, repo, workflowId, report, emit, args }))) return;
    // Tell the owner, serve on demand (parkAsk). An answered ask (or none) goes
    // straight to serve-ask.mjs, which refuses it with its own error.
    await serveOwnerAsk({ ledger, args, repo, emit, workflowId, dispatchId, report: openAsk });
  },
};
