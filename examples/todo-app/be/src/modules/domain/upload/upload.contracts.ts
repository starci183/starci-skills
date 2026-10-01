import type { Outcome } from "@modules/platform/primitives"
import type { UploadErrorCode } from "./errors/upload.error"

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

/** What opening an upload intent needs. */
export interface CreateIntentParams {
    /** The person who will own the upload. */
    readonly ownerId: string
    /** The file name; blank after trimming becomes `file`. */
    readonly filename: string
    /** The declared media type. */
    readonly mime: string
    /** The declared size in bytes. */
    readonly sizeBytes: number
}

/** What a direct upload needs: the bytes travel with the request. */
export interface CreateDirectParams {
    /** The person who will own the upload. */
    readonly ownerId: string
    /** The file name; blank after trimming becomes `file`. */
    readonly filename: string
    /** The declared media type. */
    readonly mime: string
    /** The bytes received. */
    readonly content: Buffer
}

/** What storing the bytes of a pending upload needs. */
export interface AcceptContentParams {
    /** The upload the bytes are for. */
    readonly uploadId: string
    /** The presigned token presented, if any. */
    readonly token: string | undefined
    /** The bytes received. */
    readonly content: Buffer
}

/** What attaching an upload to a task needs. */
export interface AttachParams {
    /** The person acting; must own the upload and the task. */
    readonly actorId: string
    /** The upload. */
    readonly uploadId: string
    /** The task to attach to. */
    readonly taskId: string
}

/** What deleting an upload needs. */
export interface RemoveParams {
    /** The person acting; must own the upload. */
    readonly actorId: string
    /** The upload. */
    readonly uploadId: string
}

/** What listing the uploads of a task needs. */
export interface ListTaskUploadsParams {
    /** The person acting; must own the task. */
    readonly actorId: string
    /** The task. */
    readonly taskId: string
}

/** What reading the bytes of an upload needs. */
export interface ReadContentParams {
    /** The person acting; must own the upload. */
    readonly actorId: string
    /** The upload. */
    readonly uploadId: string
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

/** The public columns of an upload: the owner and the storage key stay inside. */
export interface UploadSummary {
    /** The upload id. */
    readonly uploadId: string
    /** The task the upload is attached to, null while it is unattached. */
    readonly taskId: string | null
    /** The file name. */
    readonly filename: string
    /** The media type. */
    readonly mime: string
    /** The size in bytes. */
    readonly sizeBytes: number
    /** The lifecycle. */
    readonly status: UploadStatus
    /** When the row was created. */
    readonly createdAt: Date
}

/** One header the client sends with the presigned request. */
export interface UploadHeader {
    /** The header name. */
    readonly name: string
    /** The header value. */
    readonly value: string
}

/** The presigned request the client fulfils on the content door. */
export interface UploadIntent {
    /** The pending upload. */
    readonly uploadId: string
    /** The verb of the content door. */
    readonly method: "PUT"
    /** The path of the content door. */
    readonly url: string
    /** The headers to send. */
    readonly headers: ReadonlyArray<UploadHeader>
    /** When the token stops being valid. */
    readonly expiresAt: Date
}

/** The confirmation of a deleted upload. */
export interface DeletedUpload {
    /** The deleted upload. */
    readonly uploadId: string
    /** Always true. */
    readonly deleted: true
}

/** The uploads attached to a task. */
export interface TaskUploads {
    /** One summary per upload. */
    readonly uploads: ReadonlyArray<UploadSummary>
}

/** The bytes of an upload with the metadata a download needs. */
export interface UploadContent {
    /** The file name. */
    readonly filename: string
    /** The media type. */
    readonly mime: string
    /** The bytes. */
    readonly content: Buffer
}

/** The answer of an operation on uploads: its value, or the refusal code. */
export type UploadOutcome<Value> = Outcome<Value, UploadErrorCode>

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

/** The answer of an upload lookup: the upload, or null when there is none with that id. */
export type UploadLookupResult = UploadView | null
