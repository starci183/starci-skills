#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { cliInput } from '../lib/cli-input.mjs';
import { isMain } from '../lib/is-main.mjs';
import { invocationDir } from '../lib/roots.mjs';
import { ciOverride } from './release-ci-override.mjs';

/** Only an exact SHA, a reason and an optional repository are accepted by the owner override verb. */
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!['--sha', '--reason', '--repo'].includes(flag) || out[flag.slice(2)] !== undefined) throw new Error(`unexpected argument ${flag}`);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`${flag} needs a value`);
    out[flag.slice(2)] = value;
  }
  return out;
}

/** Print the exact files written, or the code-first refusal; owner and usage refusals exit 2. */
export async function main(argv = process.argv.slice(2), io = {}) {
  const input = cliInput(argv, io, parseArgs, 'RELEASE_CI_OVERRIDE_USAGE');
  if (!input) return 2;
  const { options: args, write, fail } = input;
  const result = await (io.ciOverride ?? ciOverride)({ ...args, repo: path.resolve(args.repo ?? invocationDir()) });
  if (!result.ok) fail(`${result.why}\n`);
  else {
    const ruling = result.ruling ? `\nWrote ${result.ruling}` : '';
    write(`Wrote ${result.file}${ruling}\nOwner: ${result.record.by}\nReason: ${result.record.reason}\n`);
  }
  return result.code;
}

if (isMain(import.meta.url)) process.exitCode = await main();
