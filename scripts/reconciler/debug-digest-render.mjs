// debug-digest-render.mjs — words an analysed digest (debug-digest-analyze.mjs) as text in the owner's language.
// Every sentence is an entry of debug-digest-text.mjs translated through scripts/lib/i18n.mjs.
import { translator } from '../lib/i18n.mjs';
import { PROBLEM_TEXT, TEXT } from './debug-digest-text.mjs';
import { standardLines, roleLines, standingLines, questionsSummary, questionLines } from './debug-digest-verdict-render.mjs';

const MIN = 60_000;
const minutes = (ms) => Math.max(0, Math.round(ms / MIN));

function agoOf(tr, ms) {
  return ms === null || ms === undefined ? tr(TEXT.never) : tr(TEXT.agoMin, { min: minutes(ms) });
}

function deadlineOf(tr, hold, now) {
  if (hold.deadlineAt === null) return tr(TEXT.noDeadline);
  const delta = hold.deadlineAt - now;
  return delta >= 0 ? tr(TEXT.inMin, { min: minutes(delta) }) : tr(TEXT.overMin, { min: minutes(-delta) });
}

function controllerWord(c) {
  return c.effective === c.configured ? `${c.name}=${c.effective}` : `${c.name}=${c.effective} (config ${c.configured})`;
}

function stepText(tr, step) {
  return step.kind === 'bound-spent' ? tr(TEXT.stepSpent, { next: step.next }) : tr(TEXT.stepInside);
}

function reconcilerLine(tr, r) {
  const leader = r.leader ? tr(TEXT.leaderLive, { pid: r.leader.pid, sec: Math.round(r.leader.heartbeatAgeMs / 1000), rev: String(r.leader.rev).slice(0, 9) }) : tr(TEXT.leaderGone);
  return tr(TEXT.reconciler, { leader, controllers: r.controllers.map(controllerWord).join(' ') });
}

function supervisorLine(tr, s) {
  return tr(TEXT.supervisor, { state: s.seat?.state ?? 'absent', terminal: s.seat?.terminal ?? '-', seen: agoOf(tr, s.seat?.lastSeenAgeMs ?? null),
    woken: agoOf(tr, s.lastWakeAgeMs), open: s.openDecisions, due: s.dueDecisions.length });
}

const BY_TEXT = Object.freeze({ retry: TEXT.byRetry, decision: TEXT.byDecision, incident: TEXT.byIncident, waits: TEXT.byWaits });

function stoppedLine(tr, j) {
  const taken = j.stepTaken ? tr(TEXT.taken, { by: tr(BY_TEXT[j.stepBy.kind], { id: j.stepBy.id, detail: j.stepBy.detail }) }) : tr(TEXT.notTaken);
  const verdict = j.reasonable ? tr(TEXT.reasonable) : tr(TEXT.unreasonable);
  return tr(TEXT.stopped, { op: j.op, status: j.status, cause: String(j.cause ?? '-').slice(0, 160), handler: j.handler ?? '-', taken, verdict });
}

function workflowLines(tr, w, now) {
  const k = w.kernel;
  const lines = [tr(TEXT.workflow, { name: w.name, ledger: w.ledger, phase: w.phase ?? '-' }),
    tr(TEXT.kernel, { alive: k.alive ? tr(TEXT.alive) : tr(TEXT.notAlive), woken: agoOf(tr, k.lastWakeAgeMs), state: k.frontierState ?? '-', ready: k.readyWork }),
    ...(k.revision ? [tr(TEXT.revisionSeat, { line: k.revision })] : [])];
  const running = w.running.map((r) => `${r.op}(${r.status}, try ${r.tryNo}, ${minutes(r.ageMs)}m)`).join(', ');
  lines.push(tr(TEXT.running, { items: running || tr(TEXT.none) }));
  for (const h of w.held) lines.push(tr(TEXT.held, { op: h.op, hold: h.hold, handler: h.handler ?? '-', step: stepText(tr, h.step), deadline: deadlineOf(tr, h, now) }));
  for (const j of w.judgements) lines.push(stoppedLine(tr, j));
  const burn = w.usage.map((u) => `${u.op} ${u.tokens} tok/${u.turns} turns/${u.attempts} try`).join(', ');
  if (burn) lines.push(tr(TEXT.burn, { items: burn }));
  return lines;
}

const problemText = (tr, p) => tr(PROBLEM_TEXT[p.code] ?? p.code, p.params);

/** The digest as text in `language`; the controllers alarm, when there is one, is the first line after the title. */
export function renderText(digest, { language, questions = false }) {
  const tr = translator(language);
  const lines = [tr(TEXT.title, { time: new Date(digest.at).toISOString() })];
  const alarm = digest.problems.find((p) => p.key === 'controllers-off');
  if (alarm) lines.push(tr(TEXT.alarm, { text: problemText(tr, alarm) }));
  lines.push(reconcilerLine(tr, digest.reconciler), supervisorLine(tr, digest.supervisor));
  if (digest.supervisor.revision) lines.push(tr(TEXT.revisionSeat, { line: digest.supervisor.revision }));
  if (!digest.workflows.length) lines.push(tr(TEXT.noWorkflow));
  for (const w of digest.workflows) lines.push(...workflowLines(tr, w, digest.at));
  if (digest.releaseCi) lines.push(tr(TEXT.releaseCi, { line: digest.releaseCi }));
  lines.push(tr(TEXT.admission, { live: digest.admission.live, leaked: digest.admission.leaked.length }), ...standardLines(tr, digest.standard),
    ...roleLines(tr, digest.roles, digest.problems, (p) => problemText(tr, p)), ...standingLines(tr, digest.debug.standing), questionsSummary(tr, digest.debug.questions),
    ...(questions ? questionLines(tr, digest.debug.questions) : []));
  if (!digest.problems.length) return [...lines, tr(TEXT.healthy)].join('\n');
  lines.push(tr(TEXT.problems));
  digest.problems.forEach((p, i) => lines.push(tr(TEXT.problemLine, { n: i + 1, blocks: p.blocks, text: problemText(tr, p) })));
  return lines.join('\n');
}

/** The line printed when there is no machine store to read. */
export const renderUnavailable = (reason, language) => translator(language)(TEXT.unavailable, { reason });
