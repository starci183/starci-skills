// kernel-ack-rev — project the required READ plan or attest its complete bytes as the current Kernel.
import fs from 'node:fs';
import { getWorkflow } from './shared/rows.mjs';
import { kernelAuthorityOf, kernelCustodyOf } from './shared/kernel-seat.mjs';
import { kernelReadManifest, unreadFiles, verifyKernelRead } from '../required-read.mjs';
import { KERNEL_REV_ACKED_EVENT, KERNEL_REV_UNKNOWN, resolveRev, revRootOf } from '../runtime-rev.mjs';

const refused = (message) => Object.assign(new Error(message), { code: 'kernel-read-unverified' });

/** The manifest a Kernel attests: the file it names, or (by its readToken) the manifest the plan returned, which must be the current one. */
function submittedOf(args, required) {
  if (args['read-manifest']) {
    const file = String(args['read-manifest']), stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw refused('READ manifest must be a regular file');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  if (args.digest === required.digest) return required;
  throw refused('the readToken is not the digest of the current required READ manifest: run --plan again');
}

export default {
  verb: 'kernel-ack-rev',
  required: args => args.plan ? ['workflow'] : ['workflow','rev'],
  flags: ['plan'],
  kernelOnly: true,
  usageInCore: true,
  usage: '  kernel-ack-rev --workflow <id> --plan [--op <id>] | --rev <sha> --digest <readToken> | --read-manifest <file> [--op <id>]   current-incarnation READ attestation (also spelled revision-ack)',
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
    // The plan names the files to read and a short readToken: the attestation needs no file (a seat cannot redirect output into one: KERNEL_NO_FILE_WRITE).
    if (args.plan) return emit({ ok: true, workflowId, readToken: required.digest, readManifest: required, unread: unreadFiles(db, workflowId, required) }, JSON.stringify(required), args.json);
    const rev = required.revision.kind === 'git' ? resolveRev(root,String(args.rev)) : String(args.rev);
    if (!rev || rev !== required.rev) throw Object.assign(new Error('READ revision is not the current deployed commit'), { code: KERNEL_REV_UNKNOWN });
    const submitted = submittedOf(args, required);
    ledger.transaction(() => {
      const current = kernelAuthorityOf(db,workflowId,caller.handle);
      const fresh = kernelReadManifest(db,workflowId,{ ...options,authority: current });
      if (fresh.digest !== required.digest) throw Object.assign(new Error('READ inputs changed before acknowledgement'), { code: 'kernel-read-unverified' });
      verifyKernelRead(submitted,fresh);
      const payload = { rev,files: fresh.files.map(row => row.path),source: 'ack',attempt: current.attempt,readManifest: fresh };
      ledger.appendEvent({ workflowId,entityType: 'kernel',entityId: workflowId,generation: current.generation,kind: KERNEL_REV_ACKED_EVENT,payload,createdAt: Date.now() });
    });
    emit({ ok: true,workflowId,rev,attempt: authority.attempt,readManifest: required }, `Kernel READ acknowledged ${workflowId} ${rev}`,args.json);
  },
};
