#!/usr/bin/env node
// terminal-send.mjs — the calls.yaml `terminal-send` call as a callable function.
//   node scripts/api/orca/terminal-send.mjs --terminal <handle> (--text <t> | --text-file <f>) [--enter] [--json]
import fs from 'node:fs';
import { orcaCall, arg, flag } from './lib.mjs';

export function terminalSend({ terminal, text, textFile, enter = true }) {
  const body = textFile ? fs.readFileSync(textFile, 'utf8') : (text ?? '');
  const r = orcaCall('terminal-send', { terminal, text: body, enter: Boolean(enter) });
  return { ok: r.exitCode === 0, receipt: r.receipt, error: r.error };
}

if (process.argv[1]?.endsWith('terminal-send.mjs')) {
  const argv = process.argv.slice(2);
  const out = terminalSend({
    terminal: arg(argv, 'terminal'),
    text: arg(argv, 'text'),
    textFile: arg(argv, 'text-file'),
    enter: !flag(argv, 'no-enter'),
  });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
