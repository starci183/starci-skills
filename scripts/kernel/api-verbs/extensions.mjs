// api extensions — what the file-based api extensions add (scripts/kernel/api-extensions.mjs): the extension
// verbs, the status fields, the extra boolean flags and any module that failed to load. Read-only, no ledger.
export default {
  verb: 'extensions',
  required: [],
  ledger: false,
  usage: '  extensions [--json]   the file-based api extensions: verbs, status fields, boolean flags, load problems',
  run({ args, emit, ext }) {
    const out = { ok: ext.problems.length === 0, verbs: [...ext.verbs.keys()].sort(), kernelOnly: [...ext.kernelOnly].sort(),
      status: ext.status.map((s) => s.key).sort(), flags: [...ext.flags].sort(), problems: ext.problems };
    emit(out, [`extension verbs: ${out.verbs.join(' ') || '-'}`, `status fields: ${out.status.join(' ') || '-'}`,
      `boolean flags: ${out.flags.join(' ') || '-'}`, ...out.problems.map((p) => `PROBLEM ${p}`)].join('\n'), args.json);
    if (!out.ok) process.exitCode = 1;
  },
};
