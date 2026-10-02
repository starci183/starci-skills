// refuse.mjs — the refusal Error every verb raises: a message plus a stable `code` (and any extra fields the
// caller attaches). `refuse` builds it, `fail` throws it, `need` throws it when a required condition is false.

/** An Error carrying `code` and `extra` fields; callers `throw` it or hand it to a result row. */
export const refuse = (message, code, extra = {}) => Object.assign(new Error(message), { code, ...extra });

/** Throws the refusal `refuse` builds — the spelling used where refusing is the whole statement. */
export const fail = (message, code, extra = {}) => { throw refuse(message, code, extra); };

/** Throws `refuse(message, code)` when `ok` is falsy — the assertion spelling of a refusal. */
export const need = (ok, message, code) => { if (!ok) throw refuse(message, code); };
