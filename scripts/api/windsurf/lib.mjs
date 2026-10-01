// scripts/api/windsurf/lib.mjs — the runner of the Windsurf (Codeium) seat API: one Connect-JSON POST
// (content-type application/json, connect-protocol-version 1). The call file beside it (seat-quota.mjs) names its one use;
// nothing outside scripts/api/windsurf imports this runner. The request carries an API key: nothing here logs or echoes it.

/** {status, body} of the POST (body clipped to 64 KiB), or {status: 0, error} when it could not complete. Never throws. */
export async function connectPost(endpoint, payload, timeoutMs) {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'connect-protocol-version': '1' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    return { status: res.status, body: text.slice(0, 65536) };
  } catch (error) {
    return { status: 0, error: String((error && error.message) || error) };
  }
}
