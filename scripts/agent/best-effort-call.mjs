/** Runs `fn`; a throw becomes {ok:false, error} so a best-effort Orca call never breaks its caller. */
export const bestEffortCall = (fn) => { try { return fn(); } catch (e) { return { ok: false, error: String(e?.message ?? e) }; } };
