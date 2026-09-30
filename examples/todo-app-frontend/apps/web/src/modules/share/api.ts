import { isRecord, parseList, parseOutcome, request, unwrap } from "@/modules/api"
import type { Collaborator, ShareRole } from "@/modules/types"

/** The role of a wire row: a collaborator is a viewer or an editor, never anything else. */
const toRole = (value: unknown): ShareRole | null => (value === "viewer" || value === "editor" ? value : null)

/** The live invitation status of a wire row, or `null` for a value the backend never sends. */
const toStatus = (value: unknown): Collaborator["status"] | null =>
    value === "pending" || value === "accepted" || value === "expired" || value === "revoked" ? value : null

/** One collaborator of the wire, or `null` when the row is not the shape the backend promises. */
const toCollaborator = (row: unknown): Collaborator | null => {
    if (!isRecord(row) || typeof row.invitationId !== "string" || typeof row.email !== "string") return null
    const role = toRole(row.role)
    const status = toStatus(row.status)
    return role === null || status === null ? null : { id: row.invitationId, email: row.email, role, status }
}

/** The collaborators of a payload. */
const toCollaborators = (data: unknown): ReadonlyArray<Collaborator> | null => parseList(data, toCollaborator)

/** Whether a revoke payload names the invitation it closed. */
const toRevoked = (data: unknown): boolean | null =>
    isRecord(data) && typeof data.invitationId === "string" ? true : null

/**
 * fr.share.list: reads the task's collaborators as the owner (or a bound collaborator) sees them; a
 * stranger reads nothing, matching the record's own exceptionFlow. A missing or expired token surfaces
 * as a thrown refusal.
 */
export const listCollaborators = async (token: string, taskId: string): Promise<ReadonlyArray<Collaborator>> =>
    unwrap(parseOutcome(await request({ operation: "Collaborators", variables: { taskId }, token }), toCollaborators))

/**
 * fr.share.invite: submits one email and one viewer/editor role for the owner's own task; an invalid
 * email or role is refused (SHARE_INVALID_EMAIL / SHARE_INVALID_ROLE on the error's `cause`) and
 * nothing is created.
 */
export const inviteCollaborator = async (
    token: string,
    taskId: string,
    email: string,
    role: ShareRole,
): Promise<Collaborator> =>
    unwrap(
        parseOutcome(
            await request({ operation: "Invite", variables: { input: { taskId, email, role } }, token }),
            toCollaborator,
        ),
    )

/**
 * fr.share.revoke: revokes one pending or accepted invitation on the owner's own task; revoking an
 * already expired or already revoked invitation is refused.
 */
export const revokeCollaborator = async (token: string, invitationId: string): Promise<void> => {
    unwrap(
        parseOutcome(
            await request({ operation: "RevokeCollaborator", variables: { input: { invitationId } }, token }),
            toRevoked,
        ),
    )
}
