import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { seedWorkflow, withLedger } from './ledger-fixture.mjs';

/** Isolated actual current-incarnation ledger and committed required-read runtime, with no provider calls. */
export function withKernelIngress(t, fn) {
  return withLedger(t, world => {
    const runtime = path.join(world.root,'runtime');
    fs.mkdirSync(runtime,{ recursive: true });
    const write = (rel, text) => { const file = path.join(runtime,rel); fs.mkdirSync(path.dirname(file),{ recursive: true }); fs.writeFileSync(file,text); };
    for (const [file,text] of Object.entries({
      'modules/kernel/kernel-prompt.md': 'Kernel prompt\\n', 'modules/kernel/driver-loop.yaml': 'tick: survey\\n',
      'modules/kernel/api.yaml': 'schema: fixture\\n', 'modules/kernel/owner-rulings.yaml': 'rulings: []\\n',
      'modules/cli/commands/kernel/status.yaml': 'verb: status\\n', 'modules/kernel/verdict-contract.yaml': 'verdict: pass\\n',
      'modules/ops/_common.yaml': 'common: fixture\\n', 'modules/ops/ops/review.verify.yaml': 'id: review.verify\\n',
      'scripts/kernel/op-prompt.mjs': 'export {};\\n', 'README.md': 'unrelated\\n' })) write(file,text.replaceAll('\\n','\n'));
    const git = (...args) => { const result = spawnSync('git',['-C',runtime,...args],{ encoding: 'utf8',windowsHide: true }); assert.equal(result.status,0,result.stderr); return result.stdout.trim(); };
    git('init','-q'); git('config','user.name','spec'); git('config','user.email','spec@example.test'); git('config','commit.gpgsign','false'); git('config','core.autocrlf','false'); git('add','-A'); git('commit','-qm','fixture');
    const workflowId = 'wf-ingress', handle = 'kernel-current', dispatch = 'dispatch-current', token = 'token-current';
    seedWorkflow(world.ledger,{ id: workflowId,generation: 1,state: { phase: 'running' },
      jobs: [{ jobId: `kernel-${workflowId}`,kind: 'kernel',status: 'running',workerId: handle,generation: 1,
        payload: { managed: { agentTerminalHandle: handle,dispatchId: dispatch },hierarchy: { role: 'kernel',workflowId,attempt: 1,generation: 1,runtime: { terminalHandle: handle } } } }],
      signals: [{ key: workflowId,token,value: { terminal: handle,dispatch },expiresAt: null }] });
    return fn({ ...world,runtime,workflowId,handle,dispatch,token,write,git });
  });
}
