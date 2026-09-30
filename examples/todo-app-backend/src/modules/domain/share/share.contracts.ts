import type { EntityManager } from "typeorm"

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

/** What inviting needs; the write joins the caller transaction. */
export interface InviteParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The owner of the task. */
    readonly ownerId: string
    /** The task. */
    readonly taskId: string
    /** The address to invite. */
    readonly email: string
    /** The role to grant; anything but viewer or editor is refused. */
    readonly role: string
    /** The instant of the decision. */
    readonly at: Date
}

/** What accepting needs; the write joins the caller transaction. */
export interface AcceptParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The accepting person. */
    readonly actorId: string
    /** The invitation. */
    readonly invitationId: string
    /** The accepting person's own address, matched against the invited one. */
    readonly email: string
    /** The instant of the decision. */
    readonly at: Date
}

/** What revoking needs; the write joins the caller transaction. */
export interface RevokeParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The person who asks; must own the invitation. */
    readonly ownerId: string
    /** The invitation. */
    readonly invitationId: string
    /** The instant of the decision. */
    readonly at: Date
}

/** What listing the invitations of a task needs. */
export interface ListInvitationsParams {
    /** The person who asks. */
    readonly actorId: string
    /** The task. */
    readonly taskId: string
    /** The instant the statuses are read at. */
    readonly at: Date
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
