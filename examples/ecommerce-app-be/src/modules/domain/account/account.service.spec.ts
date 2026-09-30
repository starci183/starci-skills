import { mockEntityManager } from "@tests/fixtures/database"
import { AccountService } from "./account.service"
import { AccountErrorCode } from "./errors/account.error"
import { hashPassword } from "./password.policy"
import { INSERT_PERSON_IF_NEW } from "./persistence/account.sql"
import { PersonEntity } from "./persistence/entities/person.entity"

const person = (): PersonEntity =>
    Object.assign(new PersonEntity(), {
        id: "p-1",
        email: "a@example.com",
        passwordHash: hashPassword("secret-pass"),
    })

describe("AccountService", () => {
    describe("verifyCredentials", () => {
        it("names the person when the email and password match", async () => {
            const entityManager = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(person()) })
            const outcome = await new AccountService(entityManager).verifyCredentials({
                email: "a@example.com",
                password: "secret-pass",
            })
            expect(outcome).toEqual({ kind: "ok", value: { personId: "p-1" } })
            expect(entityManager.findOneBy).toHaveBeenCalledWith(PersonEntity, { email: "a@example.com" })
        })

        it("refuses a wrong password and an unknown email with the same code", async () => {
            const wrongPassword = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(person()) })
            const unknown = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(null) })
            const first = await new AccountService(wrongPassword).verifyCredentials({
                email: "a@example.com",
                password: "nope",
            })
            const second = await new AccountService(unknown).verifyCredentials({
                email: "x@example.com",
                password: "nope",
            })
            expect(first).toMatchObject({ kind: "refused", code: AccountErrorCode.InvalidCredentials })
            expect(second).toMatchObject({ kind: "refused", code: AccountErrorCode.InvalidCredentials })
        })
    })

    describe("register", () => {
        it("inserts through the caller manager with a hashed password and names the new person", async () => {
            const manager = mockEntityManager({ query: jest.fn().mockResolvedValue([{ id: "p-2" }]) })
            const outcome = await new AccountService(mockEntityManager()).register({
                manager,
                email: "b@example.com",
                password: "secret-pass",
            })
            expect(outcome).toEqual({ kind: "ok", value: { personId: "p-2" } })
            expect(manager.query).toHaveBeenCalledWith(INSERT_PERSON_IF_NEW, [
                "b@example.com",
                hashPassword("secret-pass"),
            ])
        })

        it("refuses a taken email when the insert answers no row", async () => {
            const manager = mockEntityManager({ query: jest.fn().mockResolvedValue([]) })
            const outcome = await new AccountService(mockEntityManager()).register({
                manager,
                email: "b@example.com",
                password: "secret-pass",
            })
            expect(outcome).toMatchObject({ kind: "refused", code: AccountErrorCode.EmailTaken })
        })
    })

    describe("getAccount", () => {
        it("answers the id and email but never the hash", async () => {
            const entityManager = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(person()) })
            const outcome = await new AccountService(entityManager).getAccount({ personId: "p-1" })
            expect(outcome).toEqual({ kind: "ok", value: { personId: "p-1", email: "a@example.com" } })
        })

        it("refuses an unknown person", async () => {
            const entityManager = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(null) })
            const outcome = await new AccountService(entityManager).getAccount({ personId: "missing" })
            expect(outcome).toMatchObject({ kind: "refused", code: AccountErrorCode.PersonUnknown })
        })
    })
})
