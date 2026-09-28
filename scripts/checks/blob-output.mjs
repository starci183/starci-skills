#!/usr/bin/env node
// Store the stdout of any check (including draw and grammar checks) without changing its CLI.
// Usage: node scripts/checks/blob-output.mjs [--media-type TYPE] -- node check.mjs args...
//        node scripts/checks/blob-output.mjs --file <scratch-output> [--media-type TYPE]
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {isMain} from './common.mjs';
import {emitCheckOutput} from './output.mjs';

export async function blobOutputMain(argv, {run = spawnSync, put = null, write = text => process.stdout.write(text),
  fail = text => process.stderr.write(text)} = {}) {
  let file = null;
  let mediaType = 'text/plain';
  let command = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--') { command = argv.slice(i + 1); break; }
    if (argv[i] === '--file' && argv[i + 1]) file = argv[++i];
    else if (argv[i] === '--media-type' && argv[i + 1]) mediaType = argv[++i];
    else { fail('usage: blob-output.mjs [--file PATH] [--media-type TYPE] [-- COMMAND ARGS...]\n'); return 2; }
  }
  if (Boolean(file) === Boolean(command?.length)) {
    fail('blob-output: provide one scratch file or a command after --\n');
    return 2;
  }
  let bytes;
  let stderr = null;
  let exitCode = 0;
  if (file) {
    bytes = fs.readFileSync(file);
    if (mediaType === 'text/plain' && file.endsWith('.json')) mediaType = 'application/json';
  } else {
    const result = run(command[0], command.slice(1), {stdio: ['inherit', 'pipe', 'pipe'], windowsHide: true,
      maxBuffer: 256 * 1024 * 1024});
    bytes = result.stdout ?? Buffer.alloc(0);
    stderr = result.stderr?.length ? result.stderr : null;
    if (stderr) fail(stderr.toString());
    if (result.error) { fail(`${result.error.message}\n`); return 2; }
    exitCode = result.status ?? 2;
  }
  const output = await emitCheckOutput(bytes, {blob: true, mediaType, write: () => {}, put});
  const stderrOutput = stderr ? await emitCheckOutput(stderr, {blob: true, mediaType: 'text/plain', write: () => {}, put}) : null;
  write(`${JSON.stringify({...output, ...(stderrOutput ? {stderrSha: stderrOutput.sha} : {})})}\n`);
  return exitCode;
}

if (isMain(import.meta.url)) process.exitCode = await blobOutputMain(process.argv.slice(2));
