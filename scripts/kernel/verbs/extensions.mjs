// starci kernel extensions — what the file-based starci kernel extensions add (scripts/kernel/api-extensions.mjs): the extension
// verbs, the status fields, the extra boolean flags and any module that failed to load. Read-only, no ledger.
import { byCodeUnit } from '../../lib/list.mjs';
export default {
  verb: 'extensions',
  reads: true,
  required: [],
  ledger: false,
  usage: '  extensions [--json]   the file-based starci kernel extensions: verbs, status fields, boolean flags, load problems',
  run({ args, emit, ext }) {
    const out = { ok: ext.problems.length === 0, verbs: [...ext.verbs.keys()].sort(byCodeUnit), kernelOnly: [...ext.kernelOnly].sort(byCodeUnit),
      status: ext.status.map((s) => s.key).sort(byCodeUnit), flags: [...ext.flags].sort(byCodeUnit), problems: ext.problems };
    emit(out, [`extension verbs: ${out.verbs.join(' ') || '-'}`, `status fields: ${out.status.join(' ') || '-'}`,
      `boolean flags: ${out.flags.join(' ') || '-'}`, ...out.problems.map((p) => `PROBLEM ${p}`)].join('\n'), args.json);
    if (!out.ok) process.exitCode = 1;
  },
};
