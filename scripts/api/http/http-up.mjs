// http-up.mjs — retrying HTTP availability and the strict harness health response.
// Mechanically moved from reconciler/services.mjs; the caller still selects health and supplies its fetch seam.
/** GET url: ok while it answers below 500 (Cloudflare answers 502/530 when the origin or the tunnel is gone). */
async function hasHarnessHealth(res) {
  const json = /^application\/json(?:\s*;|$)/i.test(res.headers?.get('content-type') ?? '');
  let data = null;
  if (res.status === 200 && json) { try { data = (await res.json())?.data; } catch { data = null; } }
  const ledgers = data?.dbs?.ledgers;
  return res.status === 200 && json && data?.ok === true && data?.dbs?.machine === true
    && typeof data?.rev === 'string' && data.rev.length > 0 && ledgers != null
    && typeof ledgers === 'object' && !Array.isArray(ledgers) && Object.values(ledgers).every((value) => value === true);
}

export async function httpUp(url, { timeoutMs, tries = 1, health = false, fetchImpl = fetch } = {}) {
  let last = null;
  const failures = [];
  for (let i = 1; i <= Math.max(1, tries); i += 1) {
    const started = Date.now();
    try {
      const res = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
      last = { ok: res.status < 500, status: res.status, tries: i, ms: Date.now() - started };
      if (health) {
        last.ok = await hasHarnessHealth(res);
        if (!last.ok) last.error = 'harness health contract unavailable';
      }
    } catch (error) { last = { ok: false, error: String(error?.cause?.code ?? error?.name ?? error?.message ?? error).slice(0, 200), tries: i, ms: Date.now() - started }; }
    if (last.ok) return failures.length ? { ...last, failures } : last;
    failures.push(`${last.status ?? last.error} ${last.ms}ms`);
  }
  return { ...last, failures };
}
