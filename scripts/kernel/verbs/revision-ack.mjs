// revision-ack — project or attest the files a runtime revision change sends to this Kernel (modules/kernel/revision-scope.yaml).
import fs from 'node:fs';
import { getWorkflow } from './shared/rows.mjs';
import { attest, planRead } from '../../machine/revision-ack.mjs';
import { kernelSeat } from '../../machine/revision-seats.mjs';
import { KERNEL_REV_UNKNOWN, resolveRev, revRootOf } from '../runtime-rev.mjs';

const refuse = (message, code) => Object.assign(new Error(message), { code });

export default {
  verb: 'revision-ack',
  required: args => args.plan ? ['workflow'] : ['workflow','rev','read-manifest'],
  flags: ['plan'],
  kernelOnly: true,
  usageInCore: true,
  usage: '  revision-ack --workflow <id> --plan | --rev <sha> --read-manifest <file>   read the files a runtime revision change sends this Kernel',
  run({ ledger, args, caller, emit }) {
    const workflowId = args.workflow, root = revRootOf();
    if (!getWorkflow(ledger.db, workflowId)) throw refuse(`unknown workflow ${workflowId}`, 'workflow-unknown');
    const seat = kernelSeat({ ledger, workflowId, root });
    if (args.plan) {
      const { notice, manifest } = planRead(seat);
      return emit({ ok: true, workflowId, state: notice.state, readManifest: manifest }, manifest ? JSON.stringify(manifest) : `nothing is owed (${notice.state})`, args.json);
    }
    if (caller?.role !== 'kernel' || caller.workflowId !== workflowId) throw refuse('only the current Kernel may attest its read', 'kernel-caller-stale');
    if (resolveRev(root, String(args.rev)) !== seat.current) throw refuse('the revision is not the current deployed commit', KERNEL_REV_UNKNOWN);
    const file = String(args['read-manifest']), stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw refuse('the read manifest must be a regular file', 'revision-read-unverified');
    const done = attest(seat, JSON.parse(fs.readFileSync(file, 'utf8')));
    emit({ ok: true, workflowId, rev: seat.current, count: done.manifest.files.length }, `Kernel read acknowledged ${workflowId} ${seat.current}`, args.json);
  },
};
