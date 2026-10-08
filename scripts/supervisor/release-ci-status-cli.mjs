#!/usr/bin/env node
// `starci release ci-status`: the entry of ciStatus (scripts/supervisor/release-ci-status.mjs), the verdict of the GitHub workflow for a release.
import path from 'node:path';
import process from 'node:process';
import { isMain } from '../lib/is-main.mjs';
import { ciStatus } from './release-ci-status.mjs';

const VALUE_FLAGS = new Set(['--repo', '--tag']);

/** Parse `[--repo <dir>] [--tag <v*>] [--wait] [--json]`; a bad argument is an Error. */
export function parseArgs(argv) {
  const out = { json: false, wait: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json' || arg === '--wait') { out[arg.slice(2)] = true; continue; }
    if (!VALUE_FLAGS.has(arg)) throw new Error(`unknown argument ${arg}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${arg} needs a value`);
    out[arg.slice(2)] = value;
    i += 1;
  }
  return out;
}

/** Exit 0 when the workflow is green, 1 when it is red, 3 when it has not finished or GitHub could not be read, 2 on bad usage. */
export async function main(argv = process.argv.slice(2), io = {}) {
  const write = io.stdout ?? ((text) => process.stdout.write(text));
  let options;
  try { options = parseArgs(argv); } catch (error) { (io.stderr ?? ((text) => process.stderr.write(text)))(`starci release ci-status: ${error.message}\n`); return 2; }
  const result = await (io.ciStatus ?? ciStatus)({ repo: path.resolve(options.repo ?? process.cwd()), tag: options.tag ?? null, wait: options.wait, deps: io.deps ?? {} });
  const tag = result.tag ? ` ${result.tag}` : '';
  write(options.json ? `${JSON.stringify(result)}\n` : `starci release ci-status: ${result.verdict}${tag}: ${result.why}\n`);
  return result.code;
}

if (isMain(import.meta.url)) process.exitCode = await main();
