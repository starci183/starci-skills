import type { EnvSource } from "@modules/platform/config"
import type { ReceiptStorageOptions } from "./receipt-storage.options"

const DEFAULT_REGION = "us-east-1"

/** Reads the receipt storage options: the endpoint, the bucket and both credentials are required with no default; the region, the link lifetime and the timeout are tunables. */
export const parseReceiptStorageConfig = (env: EnvSource): ReceiptStorageOptions => ({
    endpoint: env.url("RECEIPTS_S3_ENDPOINT"),
    region: env.optional("RECEIPTS_S3_REGION") ?? DEFAULT_REGION,
    bucket: env.string("RECEIPTS_S3_BUCKET"),
    accessKeyId: env.string("RECEIPTS_S3_ACCESS_KEY_ID"),
    secretAccessKey: env.secret("RECEIPTS_S3_SECRET_ACCESS_KEY"),
    linkTtlMs: env.duration("RECEIPTS_LINK_TTL", 300_000),
    timeoutMs: env.duration("RECEIPTS_S3_TIMEOUT", 15_000),
})
