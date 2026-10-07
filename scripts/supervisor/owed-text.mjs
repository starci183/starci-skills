// owed-text.mjs - the wording rules of the OWED classifier (scripts/supervisor/owed.mjs): which note kinds hold nothing,
// what addresses the supervisor, what only the owner can meet, and the text rules of the worker-died, contract-conflict
// and decision labels. The Vietnamese alternatives are lexicon data (modules/goal/source-phrases.yaml owed), never literals here.
import { altOf } from '../lib/source-phrases.mjs';

/**
 * Kernel note kinds: records of a plan, a cut, a ruling or a decision already taken. They hold
 * nothing (only owner-gate and peer-wait kinds hold jobs), so they are their Kernel's to resolve
 * when done - unless the note addresses the supervisor (SUPERVISOR_ADDRESSED), which makes it OWED.
 */
const NOTE_KIND_NAMES = ['plan', 'plan-note', 'replan-note', 'scope-decision', 'owner-ruling', 'owner-directed-leg', 'grammar-bump-planned', 'stall-explanation', 'cut-decomposition', 'spec-consistency-followup', 'kernel-gate', 'experiment-note'];
const NOTE_KIND_DEFERRED = String.raw`owner-deferred(?:-[a-z0-9-]+)?`;
const NOTE_KIND_EXACT = [...NOTE_KIND_NAMES, NOTE_KIND_DEFERRED].join('|');
const NOTE_KIND_SUFFIXED = ['-note', '-decomposition', '-refinement'].map((suffix) => suffix + '$').join('|');
export const NOTE_KIND = new RegExp(`^(?:${NOTE_KIND_EXACT})$|${NOTE_KIND_SUFFIXED}`);
/** Text that addresses or waits on the supervisor, the runtime monitor, Source or the file owner. The Vietnamese
 * alternatives a note may carry are lexicon data (modules/goal/source-phrases.yaml owed), never source literals. */
export const SUPERVISOR_ADDRESSED = new RegExp(
  String.raw`\b(?:for|to|ask(?:s|ing)?|needs?|awaiting|awaits?|waits? (?:on|for))\s+(?:the\s+)?(?:supervisor|runtime monitor|source|file owner)\b`
  + String.raw`|\b(?:${altOf('owed.supervisorVerbs')})\s+supervisor\b`
  + String.raw`|\bsupervisor\s*(?:\/|${altOf('owed.orWord')}|or)\s*(?:${altOf('owed.ownerWord')}|owner)`
  + String.raw`|(?:${altOf('owed.ownerWord')}|owner)\s*(?:${altOf('owed.orWord')}|or|\/)\s*supervisor\b`
  + String.raw`|\bruntime monitor\b|\boutside (?:my |the kernel'?s |kernel |its )?authority\b|${altOf('owed.beyondAuthority')}`, 'i');
/** An owner-gate condition only the owner can meet (owner, 2026-09-24: everything else is the supervisor's). */
export const OWNER_ONLY = new RegExp(String.raw`\bcredentials?\b|\bcreds\b|\bsecrets?\b|\bpasswords?\b|\bapi[- ]?keys?\b|\boauth\b|\bconsent\b|\bpayments?\b|\bbilling\b|\blegal\b|\bpush(?:ing)? to (?:a |the )?remote\b|\bpublish(?:ing)?\b|\bhandover\b|${altOf('owed.ownerOnly')}`, 'i');

// The text rules' Vietnamese alternatives are lexicon data (modules/goal/source-phrases.yaml owed).
export const WORKER_DIED_TEXT = new RegExp(`without (?:filing )?(?:a |an )?(?:api )?report|bare PowerShell prompt|${altOf('owed.workerDied')}`, 'i');
export const CONTRACT_CONFLICT_TEXT = new RegExp(`${altOf('owed.contractConflict')}|contradict`, 'i');
export const DECISION_TEXT = new RegExp(String.raw`${altOf('owed.decision')}|\bdelegat`, 'i');
