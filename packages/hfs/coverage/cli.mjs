// cli.mjs - `starci app coverage merge --out <lcov> <report-or-dir>...`: the coverage of the sharded unit run (one coverage-final.json per
// `STARCI_COVERAGE_SHARD=1 npm test -- --shard=i/N`, downloaded into a directory by the coverage job of the managed CI) merged into the one lcov the
// coverage proof, the Codecov upload and the Sonar import read. The merge is the app's installed @starci/jest-preset (`@starci/jest-preset/merge`):
// istanbul-lib-coverage merges the shard maps by source location, and the preset's own lcov reporter writes the result exactly as an unsharded run
// would. A path is a coverage-final.json or a directory searched for every one below it; no report found refuses (exit 2), never an empty report.
// `starci app coverage verify <lcov>`: the coverage proof alone (scripts/hfs/coverage-from.mjs, the judgement `starci app check --coverage-from`
// adds to the whole check): every measured logic file is in the merged lcov at 100 per file. The managed CI's coverage job runs it after the merge,
// so the job re-runs none of the rules the fast and lint jobs already judged. Exit 0 proved, 1 refused (the report lists every finding), 2 bad usage.
import path from 'node:path';
import { createRequire } from 'node:module';
import { coverageFrom, formatCoverageReport } from '../runtime/scripts/hfs/coverage-from.mjs';

const USAGE = 'usage: starci app coverage merge --out <lcov> <coverage-final.json-or-dir>... [--cwd <dir>] | starci app coverage verify <lcov> [--cwd <dir>]';

function parse(argv) {
  const [action, ...rest] = argv;
  if (action !== 'merge' && action !== 'verify') throw new Error(USAGE);
  const opts = { inputs: [] };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--out' || arg === '--cwd') {
      const value = rest[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} needs a value; ${USAGE}`);
      opts[arg.slice(2)] = value;
      index += 1;
    } else if (arg.startsWith('--')) throw new Error(`unknown flag ${arg}; ${USAGE}`);
    else opts.inputs.push(arg);
  }
  opts.action = action;
  if (action === 'verify') {
    if (opts.out !== undefined || opts.inputs.length !== 1) throw new Error(USAGE);
    return opts;
  }
  if (!opts.out || !opts.inputs.length) throw new Error(USAGE);
  if (path.basename(opts.out) !== 'lcov.info') throw new Error(`--out names the lcov.info the coverage proof reads; ${USAGE}`);
  return opts;
}

/** The app's installed preset merge (resolved from the app root, like the presets `starci app sync` loads). */
function installedMerge(cwd) {
  try { return createRequire(path.join(cwd, 'package.json'))('@starci/jest-preset/merge').mergeCoverage; } catch (error) {
    throw new Error(`@starci/jest-preset/merge is not installed under ${cwd} (${error.code ?? error.message}); install the canon @starci/jest-preset`);
  }
}

/** The coverage proof of the app at `cwd` over the lcov `report`: exit 0 proved, 1 refused, 2 when the proof cannot run. */
function verifyCoverage(cwd, report, { stdout, stderr, prove }) {
  try {
    const result = prove({ repoRoot: cwd, coverageFrom: report });
    stdout(formatCoverageReport(result));
    return result.ok ? 0 : 1;
  } catch (error) {
    stderr(`starci app coverage verify: ${String(error?.message ?? error).split('\n')[0]}\n`);
    return 2;
  }
}

/**
 * Exit 0 merged or proved, 1 a refused proof, 2 bad usage, no preset or no report found. `merge` replaces the installed preset merge and
 * `prove` the coverage proof in a spec.
 */
export async function coverageMain(argv, { cwd: baseCwd = process.cwd(), stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s), merge, prove = coverageFrom } = {}) {
  let opts;
  try { opts = parse(argv); } catch (error) { stderr(`starci app coverage: ${error.message}\n`); return 2; }
  const cwd = path.resolve(baseCwd, opts.cwd ?? '.');
  if (opts.action === 'verify') return verifyCoverage(cwd, opts.inputs[0], { stdout, stderr, prove });
  try {
    const run = merge ?? installedMerge(cwd);
    const outDir = path.dirname(path.resolve(cwd, opts.out));
    const result = run({ inputs: opts.inputs.map((input) => path.resolve(cwd, input)), outDir });
    stdout(`starci app coverage merge: ${result.reports} shard report(s), ${result.files} source file(s) -> ${path.relative(cwd, path.join(outDir, 'lcov.info')).replaceAll('\\', '/')}\n`);
    return 0;
  } catch (error) {
    stderr(`starci app coverage: ${error.message}\n`);
    return 2;
  }
}
