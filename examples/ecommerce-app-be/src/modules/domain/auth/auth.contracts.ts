import type { Principal } from "@modules/platform/cqrs"

declare module "express-serve-static-core" {
    /** The request carries the principal the auth guard established. */
    interface Request {
        /** The authenticated caller, set by the auth guard on every non-public door. */
        principal?: Principal
    }
}

/** The person behind a verified bearer token. */
export interface VerifiedSession {
    /** The person the token authenticates. */
    readonly personId: string
}

/** How a bearer token is checked: in process against the session store, or against another service. */
export interface SessionVerifier {
    /** The session behind `sessionToken`, or null when no live session answers it. */
    verify(sessionToken: string): Promise<VerifiedSession | null>
}

/** Why a door is open to anonymous callers; the vocabulary is closed. */
export enum PublicReason {
    /** Liveness and readiness probes. */
    Health = "health",
    /** The doors that establish or check a session: register, signIn, verifySession. */
    AuthHandshake = "auth-handshake",
    /** A webhook that proves itself with a signature. */
    SignedWebhook = "signed-webhook",
    /** Reads of the public catalog. */
    CatalogRead = "catalog-read",
}

/** The metadata `@Public` attaches to a door. */
export interface PublicMetadata {
    /** Why the door is anonymous. */
    readonly reason: PublicReason
}
