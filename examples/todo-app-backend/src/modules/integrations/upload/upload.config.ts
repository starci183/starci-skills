import {
    AppConfigService,
} from "@modules/platform/config/index"

/** The upload settings: storage root, size ceiling, mime allowlist and presign signing material. */
export interface UploadConfig {
    readonly storageDir: string
    readonly maxBytes: number
    readonly allowedMimes: Array<string>
    readonly signingSecret: string
    readonly presignTtlMs: number
}

/** Reads the upload settings through the platform config reader on every access, so a value changed in the environment is never cached here. */
export const uploadConfig = (source: AppConfigService): UploadConfig => ({
    get storageDir(): string {
        return source.getUploadStorageDir()
    },
    get maxBytes(): number {
        return source.getUploadMaxBytes()
    },
    get allowedMimes(): Array<string> {
        return source.getUploadAllowedMimes()
    },
    get signingSecret(): string {
        return source.getUploadSigningSecret()
    },
    get presignTtlMs(): number {
        return source.getUploadPresignTtlMs()
    },
})
