import type { Principal } from "@modules/platform/cqrs"
import { admit } from "./admission.policy"
import { IdentityErrorCode } from "./errors/identity.error"
import { PublicReason } from "./identity.contracts"

const principal: Principal = { id: "person-1", email: "person-1@example.test", role: "authenticated" }

describe("admit", () => {
    it("admits a public door with its reason, whoever calls", () => {
        expect(admit({ reason: PublicReason.Health }, undefined)).toSucceedWith(PublicReason.Health)
        expect(admit({ reason: PublicReason.SignedWebhook }, principal)).toSucceedWith(PublicReason.SignedWebhook)
    })

    it("admits a verified principal on a door that is not public", () => {
        expect(admit(undefined, principal)).toSucceedWith(principal)
    })

    it("refuses a door that is not public when no principal was verified", () => {
        expect(admit(undefined, undefined)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })
})
