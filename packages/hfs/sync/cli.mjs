#!/usr/bin/env node
// Entry for the sync-side commands: `sync` and `work-hygiene`. The @starci/hfs bin delegates here.
import { pathToFileURL } from 'node:url';
import { runSync } from './index.mjs';
import { runWorkHygiene } from './hygiene.mjs';

export async function main(argv) {
  const [command, ...rest] = argv;
  if (command === 'sync') return runSync(rest);
  if (command === 'work-hygiene') return runWorkHygiene();
  process.stdout.write('usage: hfs sync (--check | --write) [--root <dir>] | hfs work-hygiene\n');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main(process.argv.slice(2));
