import {
    DomainError 
} from "./domain-error"
import {
    ErasureRequestInvalidStateException 
} from "@modules/domain/audit/index"
import {
    SessionExpiredException 
} from "@modules/domain/session/index"
import {
    ShareForbiddenException 
} from "@modules/domain/share/index"

/** Edge cases for the shared error vocabulary beyond the main spec's per-class coverage. */

describe("DomainError edge cases",
    () => {
        it("carries an empty metadata object when none was attached",
            () => {
                // Subclass constructors default their parameter to {}, so the metadata is always an object,
                // never an absent value consumers would have to guard for.
                expect(new SessionExpiredException().metadata).toEqual({
                })
            })

        it("carries extra metadata fields a subclass did not name",
            () => {
                // The index signature exists so call sites can attach debugging fields without a cast.
                const error = new ShareForbiddenException({
                    invitationId: "i-1", actorId: "p-2", requestId: "req-9" 
                })

                expect(error.metadata).toMatchObject({
                    invitationId: "i-1", actorId: "p-2", requestId: "req-9" 
                })
            })

        it("names every error by its class and keeps the machine code apart from the name",
            () => {
                const errors: Array<DomainError> = [
                    new SessionExpiredException(),
                    new ShareForbiddenException({
                        invitationId: "i-1", actorId: "p-2" 
                    }),
                    new ErasureRequestInvalidStateException({
                        requestId: "e-1", state: "pending", expected: "verified" 
                    }),
                ]

                expect(errors.map((error) => [error.name,
                    error.code])).toEqual([
                    ["SessionExpiredException",
                        "SESSION_EXPIRED_EXCEPTION"],
                    ["ShareForbiddenException",
                        "SHARE_FORBIDDEN_EXCEPTION"],
                    ["ErasureRequestInvalidStateException",
                        "ERASURE_REQUEST_INVALID_STATE_EXCEPTION"],
                ])
            })

        it("a subclass constructor with no arguments still yields a metadata-shaped object",
            () => {
                // Destructured constructors default their parameter to {}, so a no-arg call must not throw and
                // must still carry the named fields as absent - not a broken metadata object.
                const error = new ShareForbiddenException()

                expect(error.metadata).toEqual({
                    invitationId: undefined, actorId: undefined 
                })
                expect(error.code).toBe("SHARE_FORBIDDEN_EXCEPTION")
            })
    })
