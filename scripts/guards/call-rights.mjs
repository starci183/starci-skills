import { findInOrder } from '../lib/in-order.mjs';
import { criticWriteVerdict } from './critic-reach.mjs';
import { fileWriteVerdict, redirectTargetsOf, runtimeRootOf, writeTargetsOf } from './rights.mjs';
import { policyVerdict } from './command-policy.mjs';
import { kernelSeatCallVerdict } from './kernel-seat.mjs';

// scripts/guards/call-rights.mjs — the rights refusals of one shell or file call: the file zones, the Kernel seat, the command policy.
/** The refusal of one file write for the rights role, or null: the zone declaration loads only for a role that can be refused. */
export async function fileRightsVerdict({ role, filePath, tool = 'Edit', edit = null, guard = null, shell = false }) {
  if (role === 'critic') return criticWriteVerdict({ filePath, guard, tool });
  if ((role !== 'supervisor' && role !== 'op') || !runtimeRootOf(filePath)) return null;
  let zone = { runtimeRoot: runtimeRootOf(filePath) };
  if (role === 'supervisor') {
    const pz = await import('./protected-zone.mjs');
    zone = { ...pz.zoneOfPath(filePath), catalogNames: pz.catalogNames };
  }
  return fileWriteVerdict({ role, filePath, tool, edit, guard, zone, shell });
}

/** The rights refusal of one parsed shell call: its commands (policyVerdict) and the files they write (fileRightsVerdict). */
export const policyToolVerdict = (command, verdict) => {
  const whole = [command.word ?? command.program, ...command.args].join(' ');
  return { tool: command.program, ...verdict, command: verdict.command === whole ? command.args.join(' ').slice(0, 200) : verdict.command };
};

export async function rightsOfCall({ commands, command, cwd, ctx, guard }) {
  if (!ctx.role) return null;
  // The file rights are the more specific refusal (a write into the protected zone, an op writing the runtime checkout): they come before the generic command policy.
  if (ctx.role === 'supervisor' || ctx.role === 'op' || ctx.role === 'critic') {
    // The Critic's writer programs are judged whole by the command policy (their content words are not paths): only its redirections are targets here.
    const targets = [...(ctx.role === 'critic' ? [] : commands.flatMap((c) => writeTargetsOf(c))), ...redirectTargetsOf(command, cwd)];
    let refusal = null;
    await findInOrder(targets, async (filePath) => {
      const v = await fileRightsVerdict({ role: ctx.role, filePath, tool: 'shell', guard, shell: true });
      if (v) refusal = { tool: 'shell', ...v };
      return Boolean(v);
    });
    if (refusal) return refusal;
  }
  const seat = kernelSeatCallVerdict({ role: ctx.role, command, cwd });
  if (seat) return seat;
  for (const c of commands) {
    const v = policyVerdict({ role: ctx.role, command: c, guard, handle: ctx.handle, lockOwner: ctx.lockOwner, policy: ctx.policy });
    if (v) return policyToolVerdict(c, v);
  }
  return null;
}
