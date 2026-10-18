// cli.mjs - `starci app coverage merge --out <lcov> <path>...`: the lcov reports of the sharded unit run (one per `npm test -- --shard=i/N`, downloaded into a
// directory by the coverage job of the managed CI) merged into the one report the coverage proof, the Codecov upload and the Sonar import read
// (runtime/scripts/hfs/lcov-merge.mjs: hits summed by line, function and branch identity, one record per source file). A path is an lcov file or a
// directory searched for every lcov.info below it; no report found is a refusal, so a merge never writes an empty report that would read as "nothing to measure".
import fs from 'node:fs';
import path from 'node:path';
import { lcovFilesUnder, mergeLcov } from '../runtime/scripts/hfs/lcov-merge.mjs';

const USAGE = 'usage: starci app coverage merge --out <lcov> <lcov-or-dir>... [--cwd <dir>]';

function parse(argv) {
  const [action, ...rest] = argv;
  if (action !== 'merge') throw new Error(USAGE);
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
  if (!opts.out || !opts.inputs.length) throw new Error(USAGE);
  return opts;
}

/** Exit 0 merged, 2 bad usage or no report found. */
export async function coverageMain(argv, { cwd: baseCwd = process.cwd(), stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s) } = {}) {
  let opts;
  try { opts = parse(argv); } catch (error) { stderr(`starci app coverage: ${error.message}\n`); return 2; }
  const cwd = path.resolve(baseCwd, opts.cwd ?? '.');
  const files = [];
  for (const input of opts.inputs) {
    const target = path.resolve(cwd, input);
    if (!fs.existsSync(target)) { stderr(`starci app coverage: ${input} does not exist\n`); return 2; }
    files.push(...lcovFilesUnder(target));
  }
  const out = path.resolve(cwd, opts.out);
  const sources = files.filter((file) => path.resolve(file) !== out);
  if (!sources.length) { stderr(`starci app coverage: no lcov report under ${opts.inputs.join(', ')}; the unit shards wrote none\n`); return 2; }
  const merged = mergeLcov(sources.map((file) => fs.readFileSync(file, 'utf8')));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, merged);
  const records = merged.split('\n').filter((line) => line.startsWith('SF:')).length;
  stdout(`starci app coverage merge: ${sources.length} report(s), ${records} source file(s) -> ${path.relative(cwd, out).replaceAll('\\', '/')}\n`);
  return 0;
}
