// debug-digest-verdict-render.mjs — words the operating-standard answers, the role verdicts, the debug standing and the debug
// questions of an analysed digest as text in the owner's language. Every sentence is an entry of debug-digest-verdict-text.mjs.
import { VERDICT_TEXT as T } from './debug-digest-verdict-text.mjs';

/** The standard line of one workflow: where it stands and its first departure. */
export function standardLines(tr, standard) {
  return standard.workflows.map((w) => {
    const done = w.steps.filter((s) => s.state === 'done').length;
    const applicable = w.steps.filter((s) => s.state !== 'na').length;
    const departure = w.firstDeparture ? tr(T.firstDeparture, { step: w.firstDeparture.id, actor: w.firstDeparture.actor, evidence: String(w.firstDeparture.evidence).slice(0, 140) }) : tr(T.noDeparture);
    return `${w.name}\n${tr(T.standardAt, { step: w.standardStep ?? '-', done, total: applicable, departure })}`;
  });
}

const remedyText = (tr, remedy) => (remedy.state === 'none-recorded' ? tr(T.remedyNone) : tr(T.remedyState, { state: remedy.state, case: remedy.case }));

function bugText(tr, bug, problems, describe) {
  const problem = problems.find((p) => p.key === bug.key);
  const evidence = problem ? describe(problem) : bug.key;
  return tr(T.bugItem, { code: bug.code, duty: bug.duty, evidence: String(evidence).slice(0, 200), remedy: remedyText(tr, bug.remedy) });
}

function roleLine(tr, r, problems, describe) {
  if (r.verdict === 'unobserved') return tr(T.roleUnobserved, { subject: r.subject, signal: r.signal });
  if (r.verdict === 'bug') return tr(T.roleBug, { subject: r.subject, bugs: r.bugs.map((b) => bugText(tr, b, problems, describe)).join(' | ') });
  if (r.verdict === 'happy') return tr(T.roleHappy, { subject: r.subject, count: r.happy.reduce((sum, h) => sum + h.count, 0), kinds: r.happy.map((h) => `${h.kind} ${h.count}`).join(', ') });
  return tr(T.roleNone, { subject: r.subject });
}

/** One line per role row, in the digest's order. */
export const roleLines = (tr, roles, problems, describe) => [tr(T.rolesTitle), ...roles.map((r) => roleLine(tr, r, problems, describe))];

/** The standing of the debug role against each criterion of its end condition. */
export function standingLines(tr, standing) {
  const lines = standing.criteria.map((c) => tr(T.standingLine, { id: c.id, have: c.have ?? '-', limit: tr(c.atMost ? T.atMost : T.atLeast), min: c.min, holds: tr(c.holds ? T.standingHolds : T.standingFails) }));
  return [tr(T.standingTitle), ...lines, tr(standing.met ? T.standingMet : T.standingOpen)];
}

/** The count line of the questions. */
export function questionsSummary(tr, groups) {
  const all = groups.flatMap((g) => g.questions);
  const count = (state) => all.filter((q) => q.state === state).length;
  return tr(T.questionsSummary, { today: all.filter((q) => q.answerable === 'today').length, attention: count('attention'), unknown: count('unknown'), gaps: count('gap') });
}

/** Every question with its state, evidence or missing signal. */
export function questionLines(tr, groups) {
  return groups.flatMap((g) => [tr(T.groupLine, { title: g.title }), ...g.questions.map((q) => {
    if (q.answerable === 'gap') return tr(T.questionGap, { ask: q.ask, signal: q.signal });
    const added = q.signalAdded ? ` ${tr(T.questionAdded, { signal: q.signalAdded })}` : '';
    return tr(T.questionToday, { state: q.state, ask: q.ask, evidence: `${q.evidence}${added}` });
  })]);
}
