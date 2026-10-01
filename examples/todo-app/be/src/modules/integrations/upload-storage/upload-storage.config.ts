import type { EnvSource } from "@modules/platform/config"
import type { UploadStorageOptions } from "./upload-storage.options"

const DEFAULT_REGION = "us-east-1"

/** Reads the storage options: the endpoint, the bucket and both credentials are required with no default; the region and the timeout are tunables. */
export const parseUploadStorageConfig = (env: EnvSource): UploadStorageOptions => ({
    endpoint: env.url("UPLOAD_S3_ENDPOINT"),
    region: env.optional("UPLOAD_S3_REGION") ?? DEFAULT_REGION,
    bucket: env.string("UPLOAD_S3_BUCKET"),
    accessKeyId: env.string("UPLOAD_S3_ACCESS_KEY_ID"),
    secretAccessKey: env.secret("UPLOAD_S3_SECRET_ACCESS_KEY"),
    timeoutMs: env.duration("UPLOAD_S3_TIMEOUT", 15_000),
})
