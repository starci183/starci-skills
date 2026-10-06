const KERNEL_HANDLE='term-kernel-current',KERNEL_DISPATCH='dispatch-kernel-current';

/**
 * The current Kernel seat of `workflowId` on an open `ledger`, as Kernel start leaves it: the running kernel job holding the
 * terminal, its hierarchy and managed identity, and the singleton signal. Returns the env that makes a CLI call that Kernel
 * (ORCA_TERMINAL_HANDLE): the caller is then a bound Kernel, which may attest `--by kernel` where an unbound owner may not.
 */
export const bindCurrentKernel=(ledger,workflowId)=>{
  const generation=ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId).generation;
  ledger.write.bindKernelJob({workflowId,workerId:KERNEL_HANDLE,payload:{
    managed:{agentTerminalHandle:KERNEL_HANDLE,dispatchId:KERNEL_DISPATCH},
    hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${workflowId}`,parentNodeId:`workflow:${workflowId}`,role:'kernel',
      workflowId,attempt:1,generation,runtime:{terminalHandle:KERNEL_HANDLE}},
  }});
  ledger.write.setSignal({scope:'kernel',key:workflowId,workflowId,token:'token-kernel-current',value:{terminal:KERNEL_HANDLE,dispatch:KERNEL_DISPATCH,modelAttested:true}});
  return {ORCA_TERMINAL_HANDLE:KERNEL_HANDLE};
};
