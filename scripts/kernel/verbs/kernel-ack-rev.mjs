// kernel-ack-rev — project the required READ plan or attest its complete bytes as the current Kernel.
import fs from 'node:fs';
import { getWorkflow } from './shared/rows.mjs';
import { kernelAuthorityOf, kernelCustodyOf } from './shared/kernel-seat.mjs';
import { kernelReadManifest, verifyKernelRead } from '../required-read.mjs';
import { KERNEL_REV_ACKED_EVENT, KERNEL_REV_UNKNOWN, resolveRev, revRootOf } from '../runtime-rev.mjs';

export default {
  verb: 'kernel-ack-rev',
  required: args => args.plan ? ['workflow'] : ['workflow','rev','read-manifest'],
  flags: ['plan'],
  kernelOnly: true,
  usageInCore: true,
  usage: '  kernel-ack-rev --workflow <id> --plan [--op <id>] | --rev <sha> --read-manifest <file> [--op <id>]   current-incarnation READ attestation',
  run({ ledger, args, caller, emit }) {
    const db = ledger.db, workflowId = args.workflow, root = revRootOf();
    const wf = getWorkflow(db, workflowId);
    if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    const terminal = kernelCustodyOf(db, workflowId).terminal;
    const authority = kernelAuthorityOf(db,workflowId,args.plan ? terminal : caller?.handle);
    if (!args.plan && (caller?.role !== 'kernel' || caller.workflowId !== workflowId))
      throw Object.assign(new Error('only the current Kernel may attest its READ'), { code: 'kernel-caller-stale' });
    const options = { root,authority,ops: args.op ? [String(args.op)] : [] };
    const required = kernelReadManifest(db,workflowId,options);
    if (args.plan) return emit({ ok: true, workflowId, readManifest: required }, JSON.stringify(required), args.json);
    const rev = required.revision.kind === 'git' ? resolveRev(root,String(args.rev)) : String(args.rev);
    if (!rev || rev !== required.rev) throw Object.assign(new Error('READ revision is not the current deployed commit'), { code: KERNEL_REV_UNKNOWN });
    const file = String(args['read-manifest']), stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Object.assign(new Error('READ manifest must be a regular file'), { code: 'kernel-read-unverified' });
    const submitted = JSON.parse(fs.readFileSync(file,'utf8'));
    ledger.transaction(() => {
      const current = kernelAuthorityOf(db,workflowId,caller.handle);
      const fresh = kernelReadManifest(db,workflowId,{ ...options,authority: current });
      if (fresh.digest !== required.digest) throw Object.assign(new Error('READ inputs changed before acknowledgement'), { code: 'kernel-read-unverified' });
      verifyKernelRead(submitted,fresh);
      ledger.appendEvent({ workflowId,entityType: 'kernel',entityId: workflowId,generation: current.generation,kind: KERNEL_REV_ACKED_EVENT,
        payload: { rev,files: fresh.files.map(row => row.path),source: 'ack',attempt: current.attempt,readManifest: fresh },createdAt: Date.now() });
    });
    emit({ ok: true,workflowId,rev,attempt: authority.attempt,readManifest: required }, `Kernel READ acknowledged ${workflowId} ${rev}`,args.json);
  },
};
