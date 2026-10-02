// starci kernel verify-proofs — every indexed file re-hashed against its chained sha256, and the events chain walked
// (proof-integrity.mjs verifyProofs); exit 1 on tampering. Split out of cli.mjs (lane slim-04); its help
// line stays in cli.mjs usage() (usageInCore).
//
//   verify-proofs --workflow <id>
import { verifyProofs } from '../proof-integrity.mjs';

export default {
  verb: 'verify-proofs',
  required: ['workflow'],
  usageInCore: true,
  usage: '  verify-proofs --workflow <id>   re-hash every indexed proof file and walk the events digest chain; exit 1 on tampering',
  run({ ledger, args, repo, emit, internals }) {
    if (!internals.getWorkflow(ledger.db, args.workflow)) throw Object.assign(new Error(`unknown workflow ${args.workflow}`), { code: 'workflow-unknown' });
    const out = verifyProofs(ledger.db, args.workflow, { repo });
    emit(out, [`verify-proofs ${args.workflow}: ${out.ok ? 'ok' : 'TAMPERED'} - ${out.files.intact}/${out.files.checked} file(s) intact, ${out.files.unchained} unchained; chain ${out.chain.ok ? 'holds' : 'BROKEN'} over ${out.chain.events} event(s)`,
      ...out.files.tampered.map((t) => `  tampered ${t.reason}: ${t.path} (${t.jobId})`),
      ...out.chain.broken.map((b) => `  chain broken at seq ${b.seq} (${b.kind}): ${b.reason}`)].join('\n'), args.json);
    if (!out.ok) process.exitCode = 1;
  },
};
