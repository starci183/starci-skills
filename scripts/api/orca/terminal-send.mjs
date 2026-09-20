#!/usr/bin/env node
// terminal-send.mjs — `orca terminal send` as a callable function.
//   node scripts/api/orca/terminal-send.mjs --terminal <handle> (--text <t> | --text-file <f>) [--enter] [--json]
import fs from 'node:fs';
import { orcaRun, jsonOf, arg, flag } from './lib.mjs';

export function terminalSend({ terminal, text, textFile, enter = true }) {
  const body = textFile ? fs.readFileSync(textFile, 'utf8') : (text ?? '');
  const argv = ['terminal', 'send', '--terminal', terminal, '--text', body, '--json'];
  if (enter) argv.push('--enter');
  const r = orcaRun(argv);
  return { ok: r.status === 0, receipt: jsonOf(r.stdout), error: r.error ?? r.stderr };
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
