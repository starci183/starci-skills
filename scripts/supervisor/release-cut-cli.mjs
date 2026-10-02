#!/usr/bin/env node
// `starci release cut`: the entry of cutRelease (scripts/supervisor/release-cut.mjs), the only path that pushes main and a release tag.
import path from 'node:path';
import process from 'node:process';
import { isMain } from '../lib/is-main.mjs';
import { cutRelease } from './release-cut.mjs';

const VALUE_FLAGS = new Set(['--repo', '--remote', '--branch', '--tag']);

/** Parse `[--repo <dir>] [--remote <name>] [--branch <name>] [--tag <v*>] [--json]`; a bad argument is an Error. */
export function parseArgs(argv) {
  const out = { json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') { out.json = true; continue; }
    if (!VALUE_FLAGS.has(arg)) throw new Error(`unknown argument ${arg}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${arg} needs a value`);
    out[arg.slice(2)] = value;
    i += 1;
  }
  return out;
}

/** Run the release cut: exit 0 when the release was cut (or would be, by the result's own verdict), 1 when it was refused, 2 on bad usage. */
export async function main(argv = process.argv.slice(2), io = {}) {
  const write = io.stdout ?? ((text) => process.stdout.write(text));
  const fail = io.stderr ?? ((text) => process.stderr.write(text));
  let options;
  try { options = parseArgs(argv); } catch (error) { fail(`starci release cut: ${error.message}\n`); return 2; }
  const cut = io.cutRelease ?? cutRelease;
  const result = await cut({ repo: path.resolve(options.repo ?? process.cwd()), remote: options.remote, branch: options.branch, tag: options.tag ?? null });
  write(options.json
    ? `${JSON.stringify(result)}\n`
    : `starci release cut: ${result.ok ? 'cut' : 'refused'} (${result.verdict ?? 'unknown'})${result.tag ? ` ${result.tag}` : ''}${result.why ? `: ${result.why}` : ''}\n`);
  return result.ok ? 0 : 1;
}

if (isMain(import.meta.url)) process.exitCode = await main();
