// An expired Kernel startup stays fenced once its scoped receipt crossed worker-start.
import { openMachineReader } from '../../engine/db/machine.mjs';

export function expiredKernelStartupHealth({ ledgerId, workflowId, value }) {
  let machine = null;
  try {
    machine = openMachineReader();
    const scopePrefix = `${ledgerId}:${workflowId}:kernel-attempt:`;
    const held = machine?.providerReservations({ activeOnly: true }).find(row => row.role === 'kernel'
      && row.scope?.scopeId?.startsWith(scopePrefix) && ['launching', 'live', 'unknown'].includes(row.state));
    if (held) return { live: false, unverified: true, reason: 'startup reservation expired with an unsettled launch receipt',
      terminal: held.handle ?? null, value };
  } catch (error) {
    return { live: false, unverified: true, reason: `startup capacity could not be verified: ${error.message}`, terminal: null, value };
  } finally { machine?.close(); }
  return { live: false, reason: 'startup reservation expired before any launch effect', terminal: null, value };
}
