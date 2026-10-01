import type { Secret } from "@modules/platform/config"

/** Options of the receipt storage integration: one private S3 bucket (MinIO in the stack), addressed path-style. */
export interface ReceiptStorageOptions {
    /** The S3 endpoint, `http(s)://host:port`; presigned links point at it, so the buyer's browser must reach it. */
    readonly endpoint: string
    /** The region requests are signed for. */
    readonly region: string
    /** The private bucket that holds the receipts. */
    readonly bucket: string
    /** The access key id. */
    readonly accessKeyId: string
    /** The secret access key. */
    readonly secretAccessKey: Secret
    /** How long a presigned download link stays valid, in milliseconds. */
    readonly linkTtlMs: number
    /** How long a call waits for the storage before it fails as a timeout. */
    readonly timeoutMs: number
}
