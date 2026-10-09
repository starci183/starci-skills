// gate-admission.mjs - a proof a job's admitted contract never taught is the runtime's to produce, not the op's to cure.
//
// A settle gate (the op loop, the mechanism proofs, the Critic verdict) refuses a done whose proof is missing. When the gate is newer than the
// job - the job was admitted and its worker is gone before the gate existed - the admitted contract never told the op to produce that proof, so
// the refusal is not an op failure and not a choice of the Kernel: it is classified `gate-newer-than-admission`, the runtime produces the proof
// when it can (the Critic: scripts/kernel/settle/critic-run.mjs) and otherwise holds the settle, bounded, and names it to the Supervisor.
// This is the one place a refusal is classified for it: every judged phase of the settle preflight passes its judgment through ownedByRuntime.
import { latestContractOf } from '../machine/contract-version.mjs';

const NEWER = Object.freeze({ code: 'gate-newer-than-admission' });
/** The failure code of a refusal for a proof the job's admission never taught. */
export const GATE_NEWER_CODE = NEWER.code;
/** The settle refusals whose proof is the runtime's to produce: neither a choice of the Kernel nor a failure of the op. */
export const RUNTIME_OWED_CODES = Object.freeze(new Set([GATE_NEWER_CODE, 'op-critic-verdict-missing']));

// The code of a missing proof -> the leading name of the line of the op prompt (scripts/kernel/op-prompt.mjs machines section) that teaches the
// step producing it. A contract (the admitted prompt) holding that name taught the step; one without it predates the gate.
const TAUGHT_BY = Object.freeze({
  'op-gate-proof-missing': 'starci-gate',
  'op-read-digest-missing': 'starci-read-digest',
  'op-doc-gate-missing': 'starci-doc-gate',
  'op-test-world-proof-missing': 'starci-test-world-run',
  'op-unit-proof-missing': 'starci-unit-run',
  'op-lint-proof-missing': 'hfs-lint',
  'op-security-findings-missing': 'hfs-lint',
  'op-release-proof-missing': 'starci-release-proof',
  'op-review-defects-missing': 'review-defects',
});

// The contract an admission files starts with this line (buildContractMarkdown in scripts/kernel/cli.mjs) and carries the op prompt; a contract of another shape
// (a fixture, a record that is not a dispatch) cannot say what the op was taught, so it never makes a proof "newer than the admission".
const DISPATCH_CONTRACT = '# dispatch contract';

/** Whether the contract the job was admitted under taught the step that produces the proof `code` names; true when the code names a proof no step teaches or the contract is no dispatch prompt. */
export function admissionTaught(db, jobId, code) {
  const token = TAUGHT_BY[code];
  if (!token) return true;
  const markdown = String(latestContractOf(db, jobId)?.markdown ?? '');
  return !markdown.startsWith(DISPATCH_CONTRACT) || markdown.includes(token);
}

/**
 * The judgment as the settle reports it: a missing proof the admitted contract never taught becomes `gate-newer-than-admission` (the original code
 * kept in `gate`); every other judgment, a red one included, is returned unchanged.
 */
export function ownedByRuntime(db, jobId, judged) {
  if (judged?.status !== 'missing' || admissionTaught(db, jobId, judged.code)) return judged;
  return { ...judged, gate: judged.code, code: GATE_NEWER_CODE,
    detail: `the gate that refused (${judged.code}) is newer than this job: its admitted contract never taught the op the step that produces the proof, and its worker is gone; the proof is the runtime's, nothing is asked of the op or the Kernel (${judged.detail})` };
}
