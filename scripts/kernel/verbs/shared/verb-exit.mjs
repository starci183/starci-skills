// verb-exit.mjs — how a verb that already printed its own refusal ends its run. An exported verb never exits the process:
// it throws VerbExit, the entry (cli.mjs runExtensionVerb) catches it, prints nothing more and sets process.exitCode.
export class VerbExit extends Error {
  constructor(exitCode = 1) {
    super(`verb ended with exit code ${exitCode}`);
    this.exitCode = exitCode;
  }
}

/** Emits the refusal object and its text through the verb context `s` ({ emit, args }), then ends the verb with exit 1. */
export const refuseVerb = (s, out, text) => {
  s.emit(out, text, s.args.json);
  throw new VerbExit(1);
};
