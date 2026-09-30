import type { Principal } from "@modules/platform/cqrs"
import type { EntityManager } from "typeorm"

declare module "express-serve-static-core" {
    /** The request carries the principal the auth guard established. */
    interface Request {
        /** The authenticated caller, set by the auth guard on every non-public door. */
        principal?: Principal
    }
}

/** Why a door is open to anonymous callers; the vocabulary is closed. */
export enum PublicReason {
    /** Liveness and readiness probes. */
    Health = "health",
    /** The doors that establish a session: sign-in. */
    AuthHandshake = "auth-handshake",
    /** A webhook that proves itself with a signature. */
    SignedWebhook = "signed-webhook",
    /** Reads of a public catalog. */
    CatalogRead = "catalog-read",
}

/** The metadata `@Public` attaches to a door. */
export interface PublicMetadata {
    /** Why the door is anonymous. */
    readonly reason: PublicReason
}

/** A live session as callers see it. */
export interface SessionView {
    /** The opaque bearer token. */
    readonly token: string
    /** The person the session belongs to. */
    readonly personId: string
    /** When the session was issued. */
    readonly issuedAt: Date
    /** When the session lapses. */
    readonly expiresAt: Date
}

/** What opening a session needs; the write joins the caller transaction. */
export interface OpenSessionParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The person signing in. */
    readonly personId: string
    /** The instant of the sign-in. */
    readonly at: Date
}

/** What reading a live session needs. */
export interface FindSessionParams {
    /** The bearer token presented. */
    readonly token: string
    /** The instant of the request. */
    readonly at: Date
}

/** What ending a session needs; the write joins the caller transaction. */
export interface RevokeSessionParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The token of the session to end. */
    readonly token: string
}

/** What purging lapsed sessions needs; the write joins the caller transaction. */
export interface PurgeSessionsParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** Sessions that lapsed at or before this instant are deleted. */
    readonly at: Date
}
