// debug-digest-verdict-text.mjs — the English source of the lines that print the operating standard, the verdict of every role, the
// debug questions and the debug standing; modules/i18n/messages/debug.yaml carries the Vietnamese of each entry (scripts/lib/i18n.mjs).
export const STANDARD_PROBLEM_TEXT = 'Step {step} of {subject} departs from the operating standard ({departure}): {evidence}';

export const VERDICT_TEXT = Object.freeze({
  standardAt: '  Standard: at step {step}, {done} of {total} steps done; {departure}',
  noDeparture: 'no departure',
  firstDeparture: 'first departure: {step} ({actor}) - {evidence}',
  rolesTitle: 'Verdict per role (no error / happy error / BUG; happy errors are counted and never a problem):',
  roleNone: '  {subject}: no error',
  roleHappy: '  {subject}: happy error x{count} ({kinds})',
  roleBug: '  {subject}: BUG - {bugs}',
  roleUnobserved: '  {subject}: unobserved (needs the signal: {signal})',
  bugItem: '{code}; broken duty {duty}; evidence: {evidence}; remedy {remedy}',
  remedyNone: 'none recorded',
  remedyState: '{state} ({case})',
  standingTitle: 'Debug standing against its end condition:',
  standingLine: '  {id}: {have} (needs {limit} {min}) - {holds}',
  atLeast: 'at least',
  atMost: 'at most',
  standingHolds: 'holds',
  standingFails: 'does not hold',
  standingMet: 'Every criterion holds: Debug may retire.',
  standingOpen: 'The end condition is not met: Debug stays.',
  questionsSummary: 'Debug questions: {today} answerable today ({attention} need attention, {unknown} unjudged), {gaps} documented gaps (starci debug digest --questions lists them)',
  groupLine: '  {title}',
  questionToday: '    [{state}] {ask} {evidence}',
  questionGap: '    [gap] {ask} Needs the signal: {signal}',
  questionAdded: '(signal added: {signal})',
});
