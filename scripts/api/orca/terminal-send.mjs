#!/usr/bin/env node
// terminal-send.mjs — the calls.yaml `terminal-send` call as a callable function.
//   node scripts/api/orca/terminal-send.mjs --terminal <handle> (--text <t> | --text-file <f>) [--enter] [--json]
import fs from 'node:fs';
import { orcaCall, arg, flag } from './lib.mjs';

export function terminalSend({ terminal, text, textFile, enter = true }) {
  const body = textFile ? fs.readFileSync(textFile, 'utf8') : (text ?? '');
  const r = orcaCall('terminal-send', { terminal, text: body, enter: Boolean(enter) });
  // errorCode names Orca's refusal; agent_prompt_stalled means the text was
  // typed but Orca could not see it submitted (calls.yaml terminal-send note),
  // so the caller proves delivery from the screen instead of this receipt.
  const e = r.receipt?.error;
  const errorCode = typeof e === 'object' && e ? (e.code ?? null) : null;
  return { ok: r.exitCode === 0, receipt: r.receipt, errorCode, error: r.error };
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
