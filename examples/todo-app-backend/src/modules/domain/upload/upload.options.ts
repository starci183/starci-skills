import type { Secret } from "@modules/platform/config"

/** Options of the upload capability. */
export interface UploadOptions {
    /** The largest object accepted, in bytes. */
    readonly maxBytes: number
    /** The media types an upload may declare. */
    readonly allowedMimes: ReadonlyArray<string>
    /** How long a presigned content token stays valid, in milliseconds. */
    readonly presignTtlMs: number
    /** The secret that signs presigned content tokens. */
    readonly signingSecret: Secret
}
