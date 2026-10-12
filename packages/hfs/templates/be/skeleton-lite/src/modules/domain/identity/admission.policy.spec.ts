import type { Principal } from "@modules/platform/cqrs"
import { admit } from "./admission.policy"
import { IdentityErrorCode } from "./errors/identity.error"
import { PublicReason } from "./identity.contracts"

const principal: Principal = { id: "user-1", role: "authenticated" }

describe("admit", () => {
    it("admits a door that states why it is public, with or without a caller", () => {
        expect(admit({ reason: PublicReason.Health }, undefined)).toSucceedWith(PublicReason.Health)
        expect(admit({ reason: PublicReason.SignedWebhook }, principal)).toSucceedWith(PublicReason.SignedWebhook)
    })

    it("admits the verified principal of a door that is not public", () => {
        expect(admit(undefined, principal)).toSucceedWith(principal)
    })

    it("refuses a door that is not public when no principal was verified", () => {
        expect(admit(undefined, undefined)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })
})
