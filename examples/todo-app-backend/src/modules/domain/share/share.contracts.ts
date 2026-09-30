import type { Outcome } from "@modules/platform/primitives"
import type { ShareErrorCode } from "./errors/share.error"

/** The roles an invitation can grant. */
export enum ShareRole {
    /** May read the task. */
    Viewer = "viewer",
    /** May read and complete the task. */
    Editor = "editor",
}

/** The statuses an invitation reads as; expired is derived from the sent instant, never stored by a sweep. */
export enum InvitationStatus {
    /** Sent and waiting for the invitee. */
    Pending = "pending",
    /** Accepted by the invitee. */
    Accepted = "accepted",
    /** Not accepted inside the window. */
    Expired = "expired",
    /** Revoked by the owner. */
    Revoked = "revoked",
}

/** An invitation as callers see it, with the status it reads as at the instant of the read. */
export interface InvitationView {
    /** The invitation id. */
    readonly id: string
    /** The task the invitation is on. */
    readonly taskId: string
    /** The person who owns the task. */
    readonly ownerId: string
    /** The invited address. */
    readonly email: string
    /** The granted role. */
    readonly role: string
    /** The live status. */
    readonly status: string
    /** When the invitation was sent. */
    readonly sentAt: Date
    /** When the invitee accepted, null until then. */
    readonly acceptedAt: Date | null
    /** When the owner revoked, null until then. */
    readonly revokedAt: Date | null
    /** The person bound by accepting, null until then. */
    readonly personId: string | null
}

/** What inviting needs. */
export interface InviteParams {
    /** The owner of the task. */
    readonly ownerId: string
    /** The task. */
    readonly taskId: string
    /** The address to invite. */
    readonly email: string
    /** The role to grant; anything but viewer or editor is refused. */
    readonly role: string
}

/** What accepting needs. */
export interface AcceptParams {
    /** The accepting person. */
    readonly actorId: string
    /** The invitation. */
    readonly invitationId: string
    /** The accepting person's own address, matched against the invited one. */
    readonly email: string
}

/** What revoking needs. */
export interface RevokeParams {
    /** The person who asks; must own the invitation. */
    readonly ownerId: string
    /** The invitation. */
    readonly invitationId: string
}

/** What listing the invitations of a task needs. */
export interface ListInvitationsParams {
    /** The person who asks. */
    readonly actorId: string
    /** The task. */
    readonly taskId: string
}

/** What the completion rule needs. */
export interface MayCompleteParams {
    /** The person who wants to complete. */
    readonly actorId: string
    /** The task. */
    readonly taskId: string
    /** The owner of the task. */
    readonly ownerId: string
}

/** What decides how an invitation reads at a given instant: its stored status and when it was sent. */
export interface StoredInvitationStatus {
    /** The stored status. */
    readonly status: string
    /** When the invitation was sent. */
    readonly sentAt: Date
}

/** The answer of inviting: the created or re-opened invitation, or a refusal. */
export type InviteResult = Outcome<
    {
        readonly invitationId: string
        readonly taskId: string
        readonly email: string
        readonly role: string
        readonly status: string
    },
    ShareErrorCode
>

/** The answer of accepting: the bound role and status, or a refusal. */
export type AcceptResult = Outcome<
    { readonly invitationId: string; readonly role: string; readonly status: string },
    ShareErrorCode
>

/** The answer of revoking: the revoked invitation, or a refusal. */
export type RevokeResult = Outcome<{ readonly invitationId: string; readonly status: string }, ShareErrorCode>

/** The invitations of a task with their live statuses. */
export interface CollaboratorList {
    /** One summary per invitation the asker may see. */
    readonly collaborators: ReadonlyArray<{
        readonly invitationId: string
        readonly email: string
        readonly role: string
        readonly status: string
    }>
}
