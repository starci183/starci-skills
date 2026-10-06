// verb-exit.mjs — how a verb that already printed its own refusal ends its run. An exported verb never exits the process:
// it throws VerbExit, the entry (cli.mjs runExtensionVerb) catches it, prints nothing more and sets process.exitCode.
export class VerbExit extends Error {
  constructor(exitCode = 1) {
    super(`verb ended with exit code ${exitCode}`);
    this.exitCode = exitCode;
  }
}
