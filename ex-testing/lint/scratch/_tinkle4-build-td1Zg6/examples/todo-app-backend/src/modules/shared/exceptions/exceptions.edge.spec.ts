import {
    AbstractException 
} from "./errors/abstract"
import {
    ErasureRequestInvalidStateException 
} from "./errors/audit/erasure-request-invalid-state"
import {
    SessionExpiredException 
} from "./errors/session/session-expired"
import {
    ShareForbiddenException 
} from "./errors/share/forbidden"


/** Edge cases for the shared exception vocabulary beyond the main spec's per-class coverage:
 * serialization behaviour at the metadata boundaries callers actually transport over. */

describe("AbstractException edge cases",
    () => {
        it("toJSON carries an empty metadata object when none was attached",
            async () => {
                // Subclass constructors default their parameter to {}, so the serialized form always carries a
                // metadata key - an empty object, never an absent key consumers would have to guard for.
                const parsed = JSON.parse(new SessionExpiredException().toJSON()) as Record<string, unknown>
                expect(parsed).toEqual({
                    message: "The session has expired.", code: "SESSION_EXPIRED_EXCEPTION", metadata: {
                    } 
                })
            })

        it("toJSON round-trips extra metadata fields a subclass did not name",
            async () => {
                // The index signature exists so call sites can attach debugging fields without a cast; the
                // serialized form must carry them, not just the fields the interface declares.
                const error = new ShareForbiddenException({
                    invitationId: "i-1", actorId: "p-2", requestId: "req-9" 
                })
                const parsed = JSON.parse(error.toJSON()) as { metadata: Record<string, unknown> }
                expect(parsed.metadata).toMatchObject({
                    invitationId: "i-1", actorId: "p-2", requestId: "req-9" 
                })
            })

        it("keeps code identical to name for transport matching, on every subclass path",
            async () => {
                // Consumers match on `code` after a transport hop; `name` is the same string, never a drifted twin.
                const errors: Array<AbstractException> = [
                    new SessionExpiredException(),
                    new ShareForbiddenException({
                        invitationId: "i-1", actorId: "p-2" 
                    }),
                    new ErasureRequestInvalidStateException({
                        requestId: "e-1", state: "pending", expected: "verified" 
                    }),
                ]
                for (const error of errors) {
                    expect(error.code).toBe(error.name)
                    expect(JSON.parse(error.toJSON()).code).toBe(error.code)
                }
            })

        it("a subclass constructor with no arguments still yields a metadata-shaped object",
            async () => {
                // Destructured constructors default their parameter to {}, so a no-arg call must not throw and
                // must still carry the named fields as absent - not a broken metadata object.
                const error = new ShareForbiddenException()
                expect(error.metadata).toEqual({
                    invitationId: undefined, actorId: undefined 
                })
                expect(error.code).toBe("SHARE_FORBIDDEN_EXCEPTION")
            })
    })
