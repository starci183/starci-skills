#!/usr/bin/env node
// terminal-send.mjs — the calls.yaml `terminal-send` call as a callable function.
//   node scripts/api/orca/terminal-send.mjs --terminal <handle> (--text <t> | --text-file <f>) [--enter] [--json]
import fs from 'node:fs';
import { orcaCall, arg, flag, sleepSync } from './lib.mjs';

const codeOf = (r) => { const e = r.receipt?.error; return typeof e === 'object' && e ? (e.code ?? null) : null; };

export function terminalSend({ terminal, text, textFile, enter = true }) {
  const body = textFile ? fs.readFileSync(textFile, 'utf8') : (text ?? '');
  const r = orcaCall('terminal-send', { terminal, text: body, enter: Boolean(enter) });
  // errorCode names Orca's refusal; agent_prompt_stalled means the text was
  // typed but Orca could not see it submitted (calls.yaml terminal-send note),
  // so the caller proves delivery from the screen instead of this receipt.
  const errorCode = codeOf(r);
  // agent_prompt_blocked: Orca typed the text into an idle Codex prompt but
  // refused the Enter sent with it. Every supervisor notice and every watchdog
  // wake to the four Codex kernels sat unsubmitted that way on 2026-09-23; an
  // Enter-only send submitted each one. It is sent once, after a short beat.
  if (errorCode === 'agent_prompt_blocked' && enter && body) {
    sleepSync(700);
    const retry = orcaCall('terminal-send', { terminal, text: '', enter: true });
    const retryCode = codeOf(retry);
    return { ok: retry.exitCode === 0, receipt: retry.receipt, errorCode: retryCode, error: retry.error,
      enterRetry: { after: 'agent_prompt_blocked', ok: retry.exitCode === 0 } };
  }
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
