import { builder } from "@starci/jest-preset"
import type { InvitationRow } from "@modules/domain/share"
import type { TaskView } from "@modules/domain/task"

/** The instant the share specs run at. */
export const SHARE_AT = "2026-09-10T10:00:00.000Z"

/** When the default invitation was sent (nine days before {@link SHARE_AT}, inside the window). */
export const SHARE_SENT_AT = new Date("2026-09-01T10:00:00.000Z")

/** A sent date far enough back for the invitation to have expired at {@link SHARE_AT}. */
export const SHARE_EXPIRED_SENT_AT = new Date("2026-08-01T10:00:00.000Z")

/** A pending editor invitation of task t-1 to ann@example.com; override the status, role or person a spec is about. */
export const invitationRow = builder<InvitationRow>({
    id: "i-1",
    taskId: "t-1",
    ownerId: "owner-1",
    email: "ann@example.com",
    role: "editor",
    status: "pending",
    sentAt: SHARE_SENT_AT,
    acceptedAt: null,
    revokedAt: null,
    personId: null,
})

/** The open task t-1 of owner-1 that invitations refer to. */
export const sharedTask = builder<TaskView>({ id: "t-1", owner: "owner-1", title: "Write", complete: false, completedAt: null })
