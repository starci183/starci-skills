import { admit } from "./admission.policy"
import { IdentityErrorCode } from "./errors/identity.error"
import { PublicReason } from "./identity.contracts"

describe("admit", () => {
    it("admits a door that states why it is public", () => {
        expect(admit({ reason: PublicReason.Health })).toSucceedWith(PublicReason.Health)
    })

    it("refuses a door that is not public", () => {
        expect(admit(undefined)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })
})
