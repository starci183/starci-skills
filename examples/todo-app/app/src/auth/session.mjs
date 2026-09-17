/**
 * The session store of sds.login.session-store. Every transition of that record's state machine is a
 * function here, named after the transition id, so a reader can put the record and the code side by side.
 * Expiry is enforced on read - t-expire - because a sweeper that stops must never leave a session alive.
 */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function createSessionStore({now = Date.now} = {}) {
  const rows = new Map();
  return {
    /** t-accept: a subject from the identity provider becomes one row with an expiry. */
    accept({token, personId}) {
      if (!personId) throw new Error('t-accept needs a subject');
      rows.set(token, {personId, issuedAt: now()});
      return {token, personId};
    },
    /** t-expire is enforced here, on read, and the row leaves on the way out. */
    actorOf(token) {
      const row = token ? rows.get(token) : null;
      if (!row) return null;
      if (now() - row.issuedAt > THIRTY_DAYS_MS) { rows.delete(token); return null; }
      return {personId: row.personId};
    },
    /** t-revoke: sign-out deletes the row; the next read finds nothing. */
    revoke(token) { return rows.delete(token); },
    size() { return rows.size; }
  };
}

