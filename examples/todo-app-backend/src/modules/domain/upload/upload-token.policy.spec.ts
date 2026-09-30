import { signUploadToken, verifyUploadToken } from "./upload-token.policy"

const SECRET = "spec-secret"
const UPLOAD_ID = "upload-1"

const verify = (token: string | undefined, nowMs: number, uploadId = UPLOAD_ID, secret = SECRET): string =>
    verifyUploadToken({ uploadId, token, secret, nowMs })

describe("upload token policy", () => {
    it("verifies the token it mints, up to and including the expiry", () => {
        const token = signUploadToken({ uploadId: UPLOAD_ID, expiresAtMs: 1_000, secret: SECRET })
        expect(verify(token, 999)).toBe("ok")
        expect(verify(token, 1_000)).toBe("ok")
    })

    it("refuses a missing token and a malformed one", () => {
        expect(verify(undefined, 0)).toBe("missing")
        expect(verify("", 0)).toBe("missing")
        expect(verify("not-a-token", 0)).toBe("malformed")
        expect(verify("1000.zzz", 0)).toBe("malformed")
        expect(verify("abc.".concat("0".repeat(64)), 0)).toBe("malformed")
    })

    it("refuses a token signed for another upload or with another secret", () => {
        const forOther = signUploadToken({ uploadId: "upload-2", expiresAtMs: 1_000, secret: SECRET })
        const otherSecret = signUploadToken({ uploadId: UPLOAD_ID, expiresAtMs: 1_000, secret: "another-secret" })
        expect(verify(forOther, 0)).toBe("signature")
        expect(verify(otherSecret, 0)).toBe("signature")
    })

    it("refuses an expired token, and a token whose expiry was edited after signing fails the signature first", () => {
        const token = signUploadToken({ uploadId: UPLOAD_ID, expiresAtMs: 1_000, secret: SECRET })
        expect(verify(token, 1_001)).toBe("expired")
        expect(verify(token.replace(/^\d+\./, "9999999999999."), 0)).toBe("signature")
    })
})
