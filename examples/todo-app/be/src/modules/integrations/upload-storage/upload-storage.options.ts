import type { Secret } from "@modules/platform/config"

/** Options of the upload storage integration: one S3 bucket (MinIO in the stack), addressed path-style. */
export interface UploadStorageOptions {
    /** The S3 endpoint, `http(s)://host:port`. */
    readonly endpoint: string
    /** The region requests are signed for. */
    readonly region: string
    /** The bucket that holds the objects (`uploads/<id>`). */
    readonly bucket: string
    /** The access key id. */
    readonly accessKeyId: string
    /** The secret access key. */
    readonly secretAccessKey: Secret
    /** How long a call waits for the storage before it fails as a timeout. */
    readonly timeoutMs: number
}
