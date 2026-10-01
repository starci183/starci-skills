import type { SessionView } from "../identity.contracts"
import type { SessionEntity } from "./entities/session.entity"

/** Maps a session row to the view callers get. */
export const toSessionView = (row: SessionEntity): SessionView => ({
    token: row.token,
    personId: row.personId,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
})
