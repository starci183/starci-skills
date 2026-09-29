import "reflect-metadata"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    PersonEntity, IDENTITY_POSTGRESQL 
} from "@modules/platform/databases/index"
import {
    AccountService 
} from "./account.service"
import {
    PasswordPolicy 
} from "./password.policy"

/**
 * br.identity.sign-in at the credential boundary: the real PasswordPolicy runs (it is the demo
 * scheme password.policy.spec.ts pins against the seeded hash); the primary EntityManager is
 * the only mocked provider, at its TypeORM token.
 */
describe("AccountService - br.identity.sign-in credentials",
    () => {
        let service: AccountService
        let entityManager: { findOneBy: jest.Mock; save: jest.Mock }
        const passwords = new PasswordPolicy()

        function seededPerson(id: string, email: string, password: string): PersonEntity {
            const person = new PersonEntity()
            person.id = id
            person.email = email
            person.passwordHash = passwords.hash(password)
            return person
        }

        beforeEach(async () => {
            entityManager = {
                findOneBy: jest.fn(), save: jest.fn() 
            }
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    AccountService,
                    PasswordPolicy,
                    {
                        provide: getEntityManagerToken(IDENTITY_POSTGRESQL), useValue: entityManager 
                    },
                ],
            }).compile()
            service = module.get(AccountService)
        })

        it("returns the person id when the email exists and the password verifies",
            async () => {
                entityManager.findOneBy.mockResolvedValue(seededPerson("person-1",
                    "demo@ecommerce.dev",
                    "ecommerce-demo"))
                await expect(service.verifyCredentials("demo@ecommerce.dev",
                    "ecommerce-demo")).resolves.toBe("person-1")
                expect(entityManager.findOneBy).toHaveBeenCalledWith(PersonEntity,
                    {
                        email: "demo@ecommerce.dev" 
                    })
            })

        it("returns null for an unknown email without naming which half failed",
            async () => {
                entityManager.findOneBy.mockResolvedValue(null)
                await expect(service.verifyCredentials("nobody@ecommerce.dev",
                    "ecommerce-demo")).resolves.toBeNull()
            })

        it("returns null for a wrong password against a known email",
            async () => {
                entityManager.findOneBy.mockResolvedValue(seededPerson("person-1",
                    "demo@ecommerce.dev",
                    "ecommerce-demo"))
                await expect(service.verifyCredentials("demo@ecommerce.dev",
                    "wrong-password")).resolves.toBeNull()
            })

        it("registers a person whose stored hash verifies, and returns the new id",
            async () => {
                entityManager.save.mockImplementation(async (person: PersonEntity) => {
                    person.id = "person-new"
                    return person
                })
                await expect(service.register("fresh@ecommerce.dev",
                    "fresh-password")).resolves.toBe("person-new")
                const persisted = entityManager.save.mock.calls[0][0] as PersonEntity
                expect(persisted.email).toBe("fresh@ecommerce.dev")
                expect(persisted.passwordHash).not.toBe("fresh-password")
                expect(passwords.verify("fresh-password",
                    persisted.passwordHash)).toBe(true)
            })

        it("returns null on a unique-email violation (taken address) - one insert or none, never half-written",
            async () => {
                entityManager.save.mockRejectedValue(Object.assign(new Error("duplicate key value violates unique constraint"),
                    {
                        code: "23505" 
                    }))
                await expect(service.register("demo@ecommerce.dev",
                    "ecommerce-demo")).resolves.toBeNull()
            })

        it("recognises the violation when only the wrapped driver error carries the SQLSTATE",
            async () => {
                entityManager.save.mockRejectedValue(Object.assign(new Error("query failed"),
                    {
                        driverError: {
                            code: "23505" 
                        } 
                    }))
                await expect(service.register("demo@ecommerce.dev",
                    "ecommerce-demo")).resolves.toBeNull()
            })

        it("rethrows any other save failure so a dead database never reads as a taken address",
            async () => {
                const outage = new Error("connection refused")
                entityManager.save.mockRejectedValue(outage)
                await expect(service.register("fresh@ecommerce.dev",
                    "fresh-password")).rejects.toBe(outage)
            })

        it("answers the account view for a known person, null for an unknown id",
            async () => {
                entityManager.findOneBy.mockResolvedValue(seededPerson("person-1",
                    "demo@ecommerce.dev",
                    "ecommerce-demo"))
                await expect(service.getAccount("person-1")).resolves.toEqual({
                    personId: "person-1", email: "demo@ecommerce.dev" 
                })

                entityManager.findOneBy.mockResolvedValue(null)
                await expect(service.getAccount("person-gone")).resolves.toBeNull()
            })
    })
