import type { EnvSource } from "@modules/platform/config"
import type { UploadStorageOptions } from "./upload-storage.options"

/** Reads the storage options: the directory is required, it has no default. */
export const parseUploadStorageConfig = (env: EnvSource): UploadStorageOptions => ({
    directory: env.string("UPLOAD_DIR"),
})
