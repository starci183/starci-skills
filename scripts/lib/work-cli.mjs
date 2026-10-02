// work-cli.mjs - the `--work <dir> [--write]` CLI shell of the generated-doc scripts (scripts/example/*): parses argv,
// prints the usage when --work is missing (exit 2), runs the generator and reports wrote/stale.
import path from 'node:path';
import { arg, flag } from './cli-arg.mjs';

/**
 * Runs one generated-doc CLI: `usage` when --work is missing (exit 2), else `run(workRoot, {write})` produces the
 * result, `report(result)` prints the summary, and a --write run prints `wrote(workRoot)` while a check run whose
 * result is not ok prints `stale` and exits 1.
 */
export function workCli({ usage, run, report, wrote, stale }) {
  const args = process.argv.slice(2);
  const workArg = arg(args, 'work');
  const write = flag(args, 'write');
  if (!workArg) {
    console.error(usage);
    process.exitCode = 2;
    return;
  }
  const workRoot = path.resolve(workArg);
  const result = run(workRoot, { write });
  report(result);
  if (write) console.log(wrote(workRoot));
  else if (!result.ok) {
    console.log(stale);
    process.exitCode = 1;
  }
}
