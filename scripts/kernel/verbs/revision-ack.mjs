// revision-ack — the same verb as kernel-ack-rev under the name roles.yaml declares: ONE attestation of the files this Kernel incarnation must have read
// (the contract files, the contracts of the ops it enqueues, the files a revision change sent it). One handler, one event (runtime-rev-acked), one gate.
import ackRev from './kernel-ack-rev.mjs';

export default {
  ...ackRev,
  verb: 'revision-ack',
  usage: '  revision-ack --workflow <id> --plan [--op <id>] | --rev <sha> --digest <readToken> | --read-manifest <file>   the same verb as kernel-ack-rev',
};
