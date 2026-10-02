// telegram-polite.mjs - the Bot API pieces every Telegram sender shares: token scrubbing, the polite retry loop and the
// never-throw wrapper of one owner-facing send.
import { sleep } from '../lib/sleep.mjs';

/** Replace every occurrence of the secret (and anything shaped like a bot token) in `text`. */
export const redact = (text, secret) => {
  let out = String(text ?? '');
  if (secret) out = out.split(secret).join('***');
  return out.replace(/bot\d+:[A-Za-z0-9_-]{20,}/g, 'bot***');
};

/**
 * The polite retry loop every Bot API transport shares: `issue()` performs one attempt's fetch; 429 waits
 * `retry_after` (capped at 60 s), 5xx and network errors back off 1 s, 2 s, 4 s; any other 4xx fails at once.
 * Returns {ok, status, result, error} with the token scrubbed from the error.
 */
export async function botPolite({ token, sleepImpl = sleep, attempts = 4 }, issue) {
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await issue();
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok !== false) return { ok: true, status: res.status, result: json?.result ?? null };
      last = { ok: false, status: res.status, error: redact(json?.description ?? `HTTP ${res.status}`, token) };
      if (res.status === 429) { await sleepImpl(Math.min(Number(json?.parameters?.retry_after ?? 1), 60) * 1000); continue; }
      if (res.status < 500) return last;
    } catch (error) {
      last = { ok: false, status: null, error: redact(error?.cause?.message ?? error?.message ?? error, token) };
    }
    if (attempt < attempts) await sleepImpl(1000 * 2 ** (attempt - 1));
  }
  return last;
}

/** Runs `work` as one owner-facing send: any throw becomes one `warn` line and {ok:false}, never a throw into the caller. */
export async function attemptSend(warn, what, work) {
  try {
    return await work();
  } catch (error) {
    const line = `telegram: ${what} failed: ${redact(error?.message ?? error)}`;
    try { warn(line); } catch { /* nothing left to do */ }
    return { ok: false, error: line };
  }
}
