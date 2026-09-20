import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    signUploadToken, verifyUploadToken 
} from "./upload-token"

const SECRET = "spec-secret"
const UPLOAD_ID = "upload-1"

/**
 * The presigned-PUT credential contract: the token the intent hands out must verify, and every wrong
 * presentation - absent, garbled, signed for another upload, signed with another secret, or past its
 * expiry - must name its own verdict so the door can refuse with a reason attached.
 */
describe("upload token",
    () => {
        let moduleRef: TestingModule

        beforeAll(async () => {
            moduleRef = await Test.createTestingModule({
            }).compile()
        })

        afterAll(async () => {
            await moduleRef.close()
        })

        it("verifies the token it mints, inside the expiry window",
            () => {
                const token = signUploadToken(UPLOAD_ID,
                    1_000,
                    SECRET)
                expect(verifyUploadToken(UPLOAD_ID,
                    token,
                    SECRET,
                    999)).toBe("ok")
                expect(verifyUploadToken(UPLOAD_ID,
                    token,
                    SECRET,
                    1_000)).toBe("ok")
            })

        it("refuses a missing token and a malformed one",
            () => {
                expect(verifyUploadToken(UPLOAD_ID,
                    undefined,
                    SECRET,
                    0)).toBe("missing")
                expect(verifyUploadToken(UPLOAD_ID,
                    "",
                    SECRET,
                    0)).toBe("missing")
                expect(verifyUploadToken(UPLOAD_ID,
                    "not-a-token",
                    SECRET,
                    0)).toBe("malformed")
                expect(verifyUploadToken(UPLOAD_ID,
                    "1000.zzz",
                    SECRET,
                    0)).toBe("malformed")
            })

        it("refuses a token signed for a different upload or with a different secret",
            () => {
                const forOther = signUploadToken("upload-2",
                    1_000,
                    SECRET)
                const otherSecret = signUploadToken(UPLOAD_ID,
                    1_000,
                    "another-secret")
                expect(verifyUploadToken(UPLOAD_ID,
                    forOther,
                    SECRET,
                    0)).toBe("signature")
                expect(verifyUploadToken(UPLOAD_ID,
                    otherSecret,
                    SECRET,
                    0)).toBe("signature")
            })

        it("refuses an expired token and a token whose expiry was edited after signing",
            () => {
                const token = signUploadToken(UPLOAD_ID,
                    1_000,
                    SECRET)
                expect(verifyUploadToken(UPLOAD_ID,
                    token,
                    SECRET,
                    1_001)).toBe("expired")
                // Editing the embedded expiry breaks the signature before expiry is ever checked.
                const edited = token.replace(/^\d+\./,
                    "9999999999999.")
                expect(verifyUploadToken(UPLOAD_ID,
                    edited,
                    SECRET,
                    0)).toBe("signature")
            })
    })
