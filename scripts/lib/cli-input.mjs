// cli-input.mjs - CLI output streams and argument parsing with each command's usage prefix.
import process from 'node:process';

/** Resolve output streams and parse arguments; a usage error is printed to stderr and returns null. */
export function cliInput(argv, io, parse, prefix) {
  const write = io.stdout ?? ((text) => process.stdout.write(text));
  const fail = io.stderr ?? ((text) => process.stderr.write(text));
  try { return { options: parse(argv), write, fail }; }
  catch (error) { fail(`${prefix}: ${error.message}\n`); return null; }
}
