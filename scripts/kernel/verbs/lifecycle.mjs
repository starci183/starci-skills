// api lifecycle — pause, stop and resume a workflow (Q14; DBTREE workflow_transitions + lifecycle_changes).
//
//   lifecycle --workflow <wf> --pause  --by owner|supervisor|kernel --reason <t>   running -> paused
//   lifecycle --workflow <wf> --stop   --by owner|supervisor        --reason <t>   awaiting-approval|queued|running|paused -> stopped
//   lifecycle --workflow <wf> --resume --by owner|supervisor        --reason <t>   paused -> running (owner or Supervisor)
//                                                                                 stopped -> queued (the OWNER only)
//
// A paused or stopped workflow takes no new job (api enqueue) and launches none (api dispatch); an op already running
// finishes and settles. Paused is a hold anyone accountable may lift; stopped is the owner's: only the owner resumes it,
// and no controller ever does (MB-08). Every move is one lifecycle_changes row + the phase, in one transaction
// (engine/db/ledger.mjs changeWorkflowPhase).
import { changeWorkflowPhase } from '../../../engine/db/ledger.mjs';
import { getWorkflow } from './shared/rows.mjs';
import { canTransition, phaseOf } from './shared/workflow-transitions.mjs';
import { refuse } from '../../lib/refuse.mjs';

const MOVES = Object.freeze({
  pause: { from: ['running'], to: 'paused', by: ['owner', 'supervisor', 'kernel'] },
  stop: { from: ['awaiting-approval', 'queued', 'running', 'paused'], to: 'stopped', by: ['owner', 'supervisor'] },
  resume: { from: ['paused', 'stopped'], by: ['owner', 'supervisor'] },
});


export default {
  verb: 'lifecycle',
  required: ['workflow', 'by', 'reason'],
  flags: ['pause', 'stop', 'resume'],
  usage: '  lifecycle --workflow <id> (--pause | --stop | --resume) --by owner|supervisor|kernel --reason <text>   pause, stop or resume a workflow; only the owner resumes a stopped one',
  run({ ledger, args, emit }) {
    const db = ledger.db, workflowId = args.workflow;
    const moves = Object.keys(MOVES).filter((m) => args[m]);
    if (moves.length !== 1) throw refuse('lifecycle needs exactly one of --pause | --stop | --resume', 'lifecycle-move');
    const move = moves[0], rule = MOVES[move], by = String(args.by), reason = String(args.reason ?? '').trim();
    if (!reason) throw refuse('lifecycle needs --reason <text>: every phase change keeps why', 'lifecycle-needs-reason');
    const wf = getWorkflow(db, workflowId);
    if (!wf) throw refuse(`unknown workflow ${workflowId}`, 'workflow-unknown');
    const from = phaseOf(wf);
    if (!rule.by.includes(by)) throw refuse(`--${move} is ${rule.by.join('|')}'s, not ${by}`, 'lifecycle-by-refused');
    if (!rule.from.includes(from)) throw refuse(`--${move} moves a ${rule.from.join('|')} workflow; ${workflowId} is ${from}`, 'lifecycle-phase-refused', { phase: from });
    // Resume: paused goes back to running; stopped goes back to queued (the Kernel seat is started again from there) and
    // only on the owner's word (Q14).
    const to = move === 'resume' ? (from === 'stopped' ? 'queued' : 'running') : rule.to;
    if (move === 'resume' && from === 'stopped' && by !== 'owner') throw refuse(`only the owner resumes a stopped workflow (Q14); ${by} cannot`, 'lifecycle-owner-only');
    if (!canTransition(from, to)) throw refuse(`${from} -> ${to} is not a workflow transition`, 'lifecycle-phase-refused', { phase: from });
    ledger.transaction((tx) => changeWorkflowPhase(tx, { workflowId, to, by, reason }));
    emit({ ok: true, workflowId, move, from, to, by, reason }, `workflow ${workflowId}: ${from} -> ${to} (${move} by ${by}: ${reason})`, args.json);
  },
};
