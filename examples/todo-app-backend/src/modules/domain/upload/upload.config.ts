import type { EnvSource } from "@modules/platform/config"
import type { UploadOptions } from "./upload.options"

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024
const DEFAULT_ALLOWED_MIMES: ReadonlyArray<string> = ["text/plain", "application/pdf", "image/png", "image/jpeg"]
const DEFAULT_PRESIGN_TTL_MS = 5 * 60 * 1000

/** Reads the upload options: the size ceiling, the allowlist and the token lifetime are tunables, the signing secret is required. */
export const parseUploadConfig = (env: EnvSource): UploadOptions => {
    const declaredMimes = env.optional("UPLOAD_ALLOWED_MIMES")
    return {
        maxBytes: env.int("UPLOAD_MAX_BYTES", DEFAULT_MAX_BYTES),
        allowedMimes: declaredMimes
            ? declaredMimes
                  .split(",")
                  .map((mime) => mime.trim())
                  .filter(Boolean)
            : DEFAULT_ALLOWED_MIMES,
        presignTtlMs: env.duration("UPLOAD_PRESIGN_TTL_MS", DEFAULT_PRESIGN_TTL_MS),
        signingSecret: env.secret("UPLOAD_SIGNING_SECRET"),
    }
}
