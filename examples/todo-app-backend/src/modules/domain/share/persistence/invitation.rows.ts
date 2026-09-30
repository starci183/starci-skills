import { liveStatusOf } from "../invitation.policy"
import type { InvitationView } from "../share.contracts"
import type { InvitationEntity } from "./entities/invitation.entity"

/** Maps an invitation row to the view callers get, with the status it reads as at `at`. */
export const toInvitationView = (row: InvitationEntity, at: Date): InvitationView => ({
    id: row.id,
    taskId: row.taskId,
    ownerId: row.ownerId,
    email: row.email,
    role: row.role,
    status: liveStatusOf(row, at),
    sentAt: row.sentAt,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
    personId: row.personId,
})
