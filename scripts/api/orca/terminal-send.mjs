#!/usr/bin/env node
// terminal-send.mjs — the calls.yaml `terminal-send` call as a callable function.
//   node scripts/api/orca/terminal-send.mjs --terminal <handle> (--text <t> | --text-file <f>) [--enter] [--wait-submit <s>] [--json]
import fs from 'node:fs';
import { orcaCall, arg, flag, sleepSync } from './lib.mjs';
import { terminalShow } from './terminal-show.mjs';

const codeOf = (r) => { const e = r.receipt?.error; return typeof e === 'object' && e ? (e.code ?? null) : null; };
const dataOf = (r) => { const d = r.receipt?.error?.data; return d && typeof d === 'object' ? d : {}; };
// The seconds a --retry-request reissue watches its prompt get submitted (Orca never resends on timeout).
export const RETRY_WAIT_SUBMIT_S = 5;
// A text+Enter prompt's receipt on an Orca with prompt delivery: {requestId, stages, processIncarnation}.
const promptOf = (r) => {
  const p = r.receipt?.result?.send?.prompt;
  return p && typeof p === 'object' ? { requestId: p.requestId ?? null, stages: Array.isArray(p.stages) ? p.stages : [], processIncarnation: p.processIncarnation ?? null } : null;
};

// terminal_not_writable on a terminal Orca still shows writable is a process incarnation the host no
// longer accepts input for (a terminal created before an Orca update): permanent, never transient.
const staleIncarnation = (terminal, errorCode) => {
  if (errorCode !== 'terminal_not_writable') return false;
  try { const shown = terminalShow({ terminal }); return shown.ok && shown.connected && shown.writable; } catch { return false; }
};

// A text+Enter agent prompt with `waitSubmit` seconds (calls.yaml terminal-send-prompt): a host with
// durable prompt receipts answers result.send.prompt {requestId, stages, provider, observation} after
// observing the prompt for up to that long, and `submitted` is its turn_started stage. An ambiguous
// failure names orchestrationRequestId: the exact command is re-issued once with it. A host without
// prompt receipts refuses before any input (the flags absent from its agent-context, or
// incompatible_runtime with no unknown delivery): null, and the legacy send runs.
function promptSend({ terminal, body, waitSubmit }) {
  const params = { terminal, text: body, enter: true, 'wait-submit': waitSubmit };
  const timeout = waitSubmit * 1000 + 30000;
  let r = orcaCall('terminal-send-prompt', params, { timeout });
  if (r.reason === 'host-contract-drift') return null;
  if (codeOf(r) === 'incompatible_runtime' && dataOf(r).deliveryOutcome !== 'unknown') return null;
  let retried = null;
  if (r.exitCode !== 0 && dataOf(r).orchestrationRequestId) {
    retried = dataOf(r).orchestrationRequestId;
    r = orcaCall('terminal-send-prompt', { ...params, 'retry-request': retried }, { timeout });
  }
  const prompt = r.result?.send?.prompt ?? null;
  const errorCode = codeOf(r);
  return { ok: r.exitCode === 0 && r.result?.send?.accepted !== false, receipt: r.receipt, errorCode, error: r.error, prompt,
    submitted: Array.isArray(prompt?.stages) && prompt.stages.includes('turn_started'),
    ...(retried ? { retryRequest: retried } : {}), ...(staleIncarnation(terminal, errorCode) ? { staleIncarnation: true } : {}) };
}

export function terminalSend({ terminal, text, textFile, enter = true, waitSubmit = null }) {
  const body = textFile ? fs.readFileSync(textFile, 'utf8') : (text ?? '');
  if (waitSubmit && enter && body) {
    const prompt = promptSend({ terminal, body, waitSubmit });
    if (prompt) return prompt;
  }
  const isPrompt = Boolean(body) && Boolean(enter);
  let r = orcaCall('terminal-send', { terminal, text: body, enter: Boolean(enter) });
  // An ambiguous transport failure of a prompt carries its request id (error.data.orchestrationRequestId): the
  // exact send is reissued once with --retry-request, which Orca applies at most once, never re-sent blind.
  const requestId = r.receipt?.error?.data?.orchestrationRequestId;
  let requestRetry = null;
  if (r.exitCode !== 0 && isPrompt && typeof requestId === 'string' && requestId) {
    r = orcaCall('terminal-send', { terminal, text: body, enter: true, 'retry-request': requestId, 'wait-submit': RETRY_WAIT_SUBMIT_S });
    requestRetry = { requestId, ok: r.exitCode === 0 };
  }
  // errorCode names Orca's refusal; agent_prompt_stalled means the text was
  // typed but Orca could not see it submitted (calls.yaml terminal-send note),
  // so the caller proves delivery from the screen instead of this receipt.
  const errorCode = codeOf(r);
  const retrySafe = r.receipt?.error?.data?.retrySafe === false ? { retrySafe: false } : {};
  const extra = { prompt: promptOf(r), ...(requestRetry ? { requestRetry } : {}), ...retrySafe };
  // agent_prompt_blocked: Orca typed the text into an idle Codex prompt but
  // refused the Enter sent with it. Every supervisor notice and every watchdog
  // wake to the four Codex kernels sat unsubmitted that way on 2026-09-23; an
  // Enter-only send submitted each one. It is sent once, after a short beat.
  if (errorCode === 'agent_prompt_blocked' && enter && body) {
    sleepSync(700);
    const retry = orcaCall('terminal-send', { terminal, text: '', enter: true });
    const retryCode = codeOf(retry);
    return { ok: retry.exitCode === 0, receipt: retry.receipt, errorCode: retryCode, error: retry.error,
      enterRetry: { after: 'agent_prompt_blocked', ok: retry.exitCode === 0 }, ...extra };
  }
  return { ok: r.exitCode === 0, receipt: r.receipt, errorCode, error: r.error, ...extra,
    ...(staleIncarnation(terminal, errorCode) ? { staleIncarnation: true } : {}) };
}

if (process.argv[1]?.endsWith('terminal-send.mjs')) {
  const argv = process.argv.slice(2);
  const out = terminalSend({
    terminal: arg(argv, 'terminal'),
    text: arg(argv, 'text'),
    textFile: arg(argv, 'text-file'),
    enter: !flag(argv, 'no-enter'),
    waitSubmit: Number(arg(argv, 'wait-submit')) || null,
  });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
