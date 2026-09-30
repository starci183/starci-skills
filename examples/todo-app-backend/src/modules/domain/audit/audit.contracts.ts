import type { EntityManager } from "typeorm"

/** The actions the audit log tracks. */
export enum AuditAction {
    /** A task was created. */
    TaskCreated = "task.created",
    /** A task was completed. */
    TaskCompleted = "task.completed",
    /** A task was deleted. */
    TaskDeleted = "task.deleted",
    /** A person signed in. */
    SignedIn = "login.signed-in",
    /** A person signed out. */
    SignedOut = "login.signed-out",
    /** An erasure was requested; the line names the request, never the person. */
    ErasureRequested = "audit.erasure.requested",
    /** An erasure completed; the line names the request, never the person. */
    ErasureCompleted = "audit.erasure.completed",
}

/**
 * The actor of the lines about an erasure. Its key is never destroyed, so a completed erasure never orphans its own
 * audit trail and those lines never name the erased person.
 */
export const SYSTEM_ACTOR_ID = "system"

/** The states of an erasure request. */
export enum ErasureState {
    /** Asked, not yet verified. */
    Requested = "requested",
    /** The subject is verified. */
    Verified = "verified",
    /** Refused: the requester was not the subject. */
    Refused = "refused",
    /** The key is being destroyed. */
    Executing = "executing",
    /** Done: the key is gone and the person id dropped. */
    Complete = "complete",
}

/** The payload of one message on the audit append queue: what to write on the log. */
export interface AuditAppendPayload {
    /** The acting person, or the system actor. */
    readonly actorId: string
    /** What happened. */
    readonly action: AuditAction
    /** What it touched, null when nothing. */
    readonly target: string | null
    /** When it happened, an ISO instant. */
    readonly at: string
}

/** What a producer gives to build a message for the audit append queue. */
export interface AuditAppendMessageParams {
    /** The stable event id; a second message with the same id is the same line. */
    readonly eventId: string
    /** The acting person, or the system actor. */
    readonly actorId: string
    /** What happened. */
    readonly action: AuditAction
    /** What it touched, null when nothing. */
    readonly target: string | null
    /** When it happened. */
    readonly at: Date
}

/** A log line as a reader sees it: the actor is the decrypted person id, or null and tombstoned once the key is gone. */
export interface ResolvedAuditLine {
    /** When the action happened. */
    readonly at: Date
    /** The action label. */
    readonly action: string
    /** What it touched. */
    readonly target: string | null
    /** The decrypted actor, null when tombstoned. */
    readonly actor: string | null
    /** True when the key that sealed the actor no longer exists or no longer opens it. */
    readonly tombstoned: boolean
}

/** Where the hash chain breaks, by position in the chain as currently stored. */
export interface ChainBreak {
    /** The 0-based position of the first bad line. */
    readonly index: number
    /** A missing link, or a line whose content no longer matches its hash. */
    readonly reason: "broken-prev-hash" | "content-mismatch"
}

/** The result of walking the chain from the first line. */
export interface VerifyChainResult {
    /** True when every link and every hash holds. */
    readonly valid: boolean
    /** How many lines the walk read: the whole chain when valid, the lines before the first break otherwise. */
    readonly totalLines: number
    /** The first break, null when valid. */
    readonly break: ChainBreak | null
}

/** What answering "what does this sealed blob hold" gives: the plaintext, or why it could not be opened. */
export type UnsealOutcome =
    | { readonly opened: true; readonly plaintext: string }
    | { readonly opened: false; readonly cause: unknown }

/** What appending a line needs; the write joins the caller transaction. */
export interface AppendLineParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The acting person, or the system actor. */
    readonly actorId: string
    /** What happened. */
    readonly action: AuditAction
    /** What it touched, null when nothing. */
    readonly target: string | null
    /** When it happened. */
    readonly at: Date
}

/** What reading the whole chain, optionally narrowed, needs. */
export interface ReadChainParams {
    /** Only lines of this action, when set. */
    readonly action: string | null
    /** Only lines of this target, when set. */
    readonly target: string | null
}

/** What minting or reading a key for a person needs; the write joins the caller transaction. */
export interface GetOrCreateKeyParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The person the key belongs to. */
    readonly personId: string
    /** The instant the key is minted at, when it does not exist yet. */
    readonly at: Date
}

/** What looking up a person key id needs; reads through `manager` when the caller is inside a transaction. */
export interface FindKeyIdParams {
    /** The person. */
    readonly personId: string
    /** The caller transaction manager, when it must see its own writes. */
    readonly manager?: EntityManager
}

/** What loading key material needs; reads through `manager` when the caller is inside a transaction. */
export interface FindKeyMaterialParams {
    /** The key ids to load. */
    readonly keyIds: ReadonlyArray<string>
    /** The caller transaction manager, when it must see its own writes. */
    readonly manager?: EntityManager
}

/** What destroying a person key needs; the write joins the caller transaction. */
export interface DestroyKeyParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The person whose key is destroyed. */
    readonly personId: string
}

/** An erasure request as callers see it. */
export interface ErasureRequestView {
    /** The opaque request id. */
    readonly requestId: string
    /** The subject, null once complete. */
    readonly personId: string | null
    /** The state. */
    readonly state: string
    /** When the request was made. */
    readonly requestedAt: Date
    /** When the subject was verified. */
    readonly verifiedAt: Date | null
    /** When the request was refused. */
    readonly refusedAt: Date | null
    /** When key destruction started. */
    readonly executingAt: Date | null
    /** When the request completed. */
    readonly completedAt: Date | null
}

/** What opening an erasure request needs; the writes join the caller transaction. */
export interface RequestErasureParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The subject: always the caller. */
    readonly personId: string
    /** The instant of the request. */
    readonly at: Date
}

/** What verifying or executing an erasure request needs; the writes join the caller transaction. */
export interface ErasureStepParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The request. */
    readonly requestId: string
    /** Who asks; must be the subject of the request. */
    readonly callerId: string
    /** The instant of the step. */
    readonly at: Date
}
