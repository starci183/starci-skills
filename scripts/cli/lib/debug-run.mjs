#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { runScript } from '../../api/node/run-script.mjs';
import { isMain } from '../../lib/is-main.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// Every entry is an existing read-only route. Mutation-capable supervisor and
// kernel scripts are exposed only with a fixed status argument.
export const INSPECTORS = Object.freeze({
  'orca-status': { script: 'scripts/api/orca/status.mjs', args: [] },
  'runtime-status': { script: 'scripts/cli/lib/runtime-status.mjs', args: [] },
  'supervisor-status': { script: 'scripts/supervisor/start-supervisor.mjs', args: ['--status'] },
});

export function main(argv = process.argv.slice(2), io = {}) {
  const [inspector, ...rest] = argv;
  const route = INSPECTORS[inspector];
  if (!route || rest.some((arg) => arg !== '--json')) {
    const write = io.stderr ?? ((text) => process.stderr.write(text));
    const text = `starci: debug run expects one of: ${Object.keys(INSPECTORS).join(', ')}\n`;
    if (typeof write === 'function') write(text); else write.write(text);
    return 2;
  }
  const args = [...route.args, ...(rest.includes('--json') ? ['--json'] : [])];
  return (io.runScript ?? runScript)(path.join(runtimeRoot, route.script), args, { cwd: io.cwd ?? process.cwd() });
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
