import "reflect-metadata"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    PasswordPolicy 
} from "./password.policy"

describe("PasswordPolicy - the demo credential scheme",
    () => {
    // The exact hex seeded by the 1789800000000-create-identity-tables migration.
        const SEEDED_HASH_HEX =
    "2c2c5a95489cece045d979a708a5541a77446d9563e6fb2749d5d2c744a091e70d1e39c55cd3609b1886a9ba96e6cdee60b5a0e4373f492e09c2860dbd8f895a"
        let policy: PasswordPolicy

        beforeEach(async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [PasswordPolicy] 
            }).compile()
            policy = module.get(PasswordPolicy)
        })

        it("accepts the demo password against the seeded hash",
            () => {
                expect(policy.verify("ecommerce-demo",
                    SEEDED_HASH_HEX)).toBe(true)
            })

        it("refuses any other password against the seeded hash",
            () => {
                expect(policy.verify("wrong-password",
                    SEEDED_HASH_HEX)).toBe(false)
                expect(policy.verify("",
                    SEEDED_HASH_HEX)).toBe(false)
            })

        it("round-trips its own hash and refuses a truncated or malformed stored hash",
            () => {
                const hash = policy.hash("fresh-password")
                expect(policy.verify("fresh-password",
                    hash)).toBe(true)
                expect(policy.verify("fresh-password",
                    hash.slice(0,
                        -2))).toBe(false)
                expect(policy.verify("fresh-password",
                    "not-hex")).toBe(false)
            })
    })
