import type { EntityManager } from "typeorm"

/** The header that carries the presigned content token on the content door. */
export const UPLOAD_TOKEN_HEADER = "x-upload-token"

/** The lifecycle of an upload row: pending until its bytes land, then ready. */
export type UploadStatus = "pending" | "ready"

/** An upload as callers see it. */
export interface UploadView {
    /** The upload id. */
    readonly id: string
    /** The person who owns the upload; bound at intake and never rewritten. */
    readonly owner: string
    /** The task the upload is attached to, null while it is unattached. */
    readonly taskId: string | null
    /** The file name. */
    readonly filename: string
    /** The media type. */
    readonly mime: string
    /** The size in bytes. */
    readonly sizeBytes: number
    /** The key of the object in the storage plane. */
    readonly storageKey: string
    /** The lifecycle. */
    readonly status: UploadStatus
    /** When the row was created. */
    readonly createdAt: Date
}

/** A presigned content credential. */
export interface PresignedToken {
    /** The token the content door verifies. */
    readonly token: string
    /** When the token stops being valid. */
    readonly expiresAt: Date
}

/** What opening a pending upload needs; the write joins the caller transaction. */
export interface CreateUploadParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The person who will own the upload. */
    readonly ownerId: string
    /** The file name; blank after trimming becomes `file`. */
    readonly filename: string
    /** The declared media type. */
    readonly mime: string
    /** The declared size, or the received size for a direct upload. */
    readonly sizeBytes: number
    /** The instant of the intake. */
    readonly at: Date
}

/** What reading one upload needs. */
export interface FindUploadParams {
    /** The upload id. */
    readonly uploadId: string
}

/** What deciding whether a person may touch an upload needs. */
export interface AuthorizeUploadParams {
    /** The upload id. */
    readonly uploadId: string
    /** The person acting. */
    readonly actorId: string
}

/** What minting a content token needs. */
export interface PresignParams {
    /** The upload the token is for. */
    readonly uploadId: string
    /** The instant of the intent. */
    readonly at: Date
}

/** What deciding whether content may be stored needs. */
export interface AdmitContentParams {
    /** The upload the bytes are for. */
    readonly uploadId: string
    /** The token presented, if any. */
    readonly token: string | undefined
    /** The number of bytes received. */
    readonly sizeBytes: number
    /** The instant of the request. */
    readonly at: Date
}

/** What flipping an upload to ready needs; the write joins the caller transaction. */
export interface MarkReadyParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The upload, as read before the decision. */
    readonly upload: UploadView
    /** The number of bytes that landed. */
    readonly sizeBytes: number
}

/** What attaching an upload to a task needs; the write joins the caller transaction. */
export interface AttachUploadParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The upload, as read before the decision. */
    readonly upload: UploadView
    /** The task to attach to. */
    readonly taskId: string
}

/** What listing the uploads of a task needs. */
export interface ListTaskUploadsParams {
    /** The task. */
    readonly taskId: string
    /** The owner: only their uploads are listed. */
    readonly ownerId: string
}

/** What deleting an upload row needs; the write joins the caller transaction. */
export interface RemoveUploadParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The upload id. */
    readonly id: string
}

/** Why a presented token was refused, or `ok`. */
export type TokenVerdict = "ok" | "missing" | "malformed" | "signature" | "expired"

/** What signing a token needs. */
export interface SignUploadTokenParams {
    /** The upload the token is for. */
    readonly uploadId: string
    /** When the token expires, in epoch milliseconds. */
    readonly expiresAtMs: number
    /** The signing secret. */
    readonly secret: string
}

/** What verifying a token needs. */
export interface VerifyUploadTokenParams {
    /** The upload the token must be for. */
    readonly uploadId: string
    /** The token presented, if any. */
    readonly token: string | undefined
    /** The signing secret. */
    readonly secret: string
    /** The current instant, in epoch milliseconds. */
    readonly nowMs: number
}
