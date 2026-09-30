import { EnvSource } from "@modules/platform/config"
import { parseUploadConfig } from "./upload.config"

const REQUIRED = { UPLOAD_SIGNING_SECRET: "signing-material" }

describe("parseUploadConfig", () => {
    it("defaults the tunables: ten mebibytes, four media types, five minutes", () => {
        const options = parseUploadConfig(new EnvSource(REQUIRED))
        expect(options.maxBytes).toBe(10 * 1024 * 1024)
        expect(options.allowedMimes).toEqual(["text/plain", "application/pdf", "image/png", "image/jpeg"])
        expect(options.presignTtlMs).toBe(300_000)
        expect(options.signingSecret.reveal()).toBe("signing-material")
    })

    it("reads the tunables that are declared", () => {
        const options = parseUploadConfig(
            new EnvSource({
                ...REQUIRED,
                UPLOAD_MAX_BYTES: "1024",
                UPLOAD_ALLOWED_MIMES: "text/plain, image/gif,",
                UPLOAD_PRESIGN_TTL_MS: "30s",
            }),
        )
        expect(options.maxBytes).toBe(1024)
        expect(options.allowedMimes).toEqual(["text/plain", "image/gif"])
        expect(options.presignTtlMs).toBe(30_000)
    })

    it("has no fallback signing secret", () => {
        expect(() => parseUploadConfig(new EnvSource({}))).toThrow()
    })
})
