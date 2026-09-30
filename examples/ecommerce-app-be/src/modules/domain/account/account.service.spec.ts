import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { SESSION_SERVICE } from "@modules/domain/session"
import type { SessionService } from "@modules/domain/session"
import { ORDER_API } from "@modules/integrations/order-api"
import type { OrderApiClient } from "@modules/integrations/order-api"
import { IDENTITY_ENTITY_MANAGER } from "@modules/platform/database"
import { Test } from "@nestjs/testing"
import { personRow } from "@tests/fixtures/builders/account.builder"
import { AccountService } from "./account.service"
import { AccountErrorCode } from "./errors/account.error"
import { hashPassword } from "./password.policy"
import { INSERT_PERSON_IF_NEW } from "./persistence/account.sql"
import { PersonEntity } from "./persistence/entities/person.entity"

const person = (id: string, email: string, password: string): PersonEntity =>
    personRow({ id, email, passwordHash: hashPassword(password) })

const build = async (entityManager: MockEntityManager) => {
    const sessions = mock<SessionService>()
    const orderApi = mock<OrderApiClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountService,
            { provide: IDENTITY_ENTITY_MANAGER, useValue: entityManager },
            { provide: SESSION_SERVICE, useValue: sessions },
            { provide: ORDER_API, useValue: orderApi },
        ],
    }).compile()
    return { accounts: moduleRef.get(AccountService), sessions, orderApi }
}

describe("AccountService", () => {
    describe("verifyCredentials", () => {
        it("succeeds with the person whose email and password match", async () => {
            const em = mockEntityManager({ findOneBy: [PersonEntity, person("p-1", "an@shop.test", "s3cret-pw")] })
            const { accounts } = await build(em)

            expect(await accounts.verifyCredentials({ email: "an@shop.test", password: "s3cret-pw" })).toSucceedWith({
                personId: "p-1",
            })
            expect(em.findOneBy).toHaveBeenCalledWith(PersonEntity, { email: "an@shop.test" })
        })

        it("refuses an unknown email with the same code as a wrong password", async () => {
            const { accounts } = await build(mockEntityManager({ findOneBy: [PersonEntity, null] }))

            expect(await accounts.verifyCredentials({ email: "x@shop.test", password: "s3cret-pw" })).toBeRefused(
                AccountErrorCode.InvalidCredentials,
            )
        })

        it("refuses a wrong password", async () => {
            const em = mockEntityManager({ findOneBy: [PersonEntity, person("p-1", "an@shop.test", "s3cret-pw")] })
            const { accounts } = await build(em)

            expect(await accounts.verifyCredentials({ email: "an@shop.test", password: "other-pw" })).toBeRefused(
                AccountErrorCode.InvalidCredentials,
            )
        })
    })

    describe("signIn", () => {
        it("starts a session for the person whose credentials match", async () => {
            const em = mockEntityManager({ findOneBy: [PersonEntity, person("p-1", "an@shop.test", "s3cret-pw")] })
            const { accounts, sessions } = await build(em)
            sessions.issue.mockResolvedValue({ sessionToken: "t-1", personId: "p-1" })

            expect(await accounts.signIn({ email: "an@shop.test", password: "s3cret-pw" })).toSucceedWith({
                sessionToken: "t-1",
                personId: "p-1",
            })
            expect(sessions.issue).toHaveBeenCalledWith({ personId: "p-1" })
        })

        it("refuses wrong credentials and starts no session", async () => {
            const { accounts, sessions } = await build(mockEntityManager({ findOneBy: [PersonEntity, null] }))

            expect(await accounts.signIn({ email: "x@shop.test", password: "s3cret-pw" })).toBeRefused(
                AccountErrorCode.InvalidCredentials,
            )
            expect(sessions.issue).not.toHaveBeenCalled()
        })
    })

    describe("register", () => {
        it("inserts the person with a hashed password in one transaction and returns the new id", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_PERSON_IF_NEW, [{ id: "p-7" }]] }))
            const { accounts } = await build(tx.em)

            expect(await accounts.register({ email: "an@shop.test", password: "s3cret-pw" })).toSucceedWith({
                personId: "p-7",
            })
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_PERSON_IF_NEW, ["an@shop.test", hashPassword("s3cret-pw")])
            expect(tx.commits).toBe(1)
        })

        it("refuses a taken email", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_PERSON_IF_NEW, []] }))
            const { accounts } = await build(tx.em)

            expect(await accounts.register({ email: "an@shop.test", password: "s3cret-pw" })).toBeRefused(
                AccountErrorCode.EmailTaken,
            )
        })

        it("rolls back and rethrows when the insert fails", async () => {
            const em = mockEntityManager({ query: [INSERT_PERSON_IF_NEW, []] })
            em.query.mockRejectedValue(new Error("deadlock"))
            const tx = fakeTransaction(em)
            const { accounts } = await build(tx.em)

            await expect(accounts.register({ email: "an@shop.test", password: "s3cret-pw" })).rejects.toThrow(
                "deadlock",
            )

            expect(tx.rollbacks).toBe(1)
            expect(tx.committedWrites).toEqual([])
        })
    })

    describe("getAccount", () => {
        it("succeeds with the id and email, never the hash", async () => {
            const em = mockEntityManager({ findOneBy: [PersonEntity, person("p-1", "an@shop.test", "s3cret-pw")] })
            const { accounts } = await build(em)

            expect(await accounts.getAccount({ personId: "p-1" })).toSucceedWith({
                personId: "p-1",
                email: "an@shop.test",
            })
            expect(em.findOneBy).toHaveBeenCalledWith(PersonEntity, { id: "p-1" })
        })

        it("refuses a person that no longer exists", async () => {
            const { accounts } = await build(mockEntityManager({ findOneBy: [PersonEntity, null] }))

            expect(await accounts.getAccount({ personId: "p-9" })).toBeRefused(AccountErrorCode.PersonUnknown)
        })
    })

    describe("overview", () => {
        it("fails with the order service error instead of answering hasOrders false", async () => {
            const em = mockEntityManager({ findOneBy: [PersonEntity, person("p-1", "an@shop.test", "s3cret-pw")] })
            const { accounts, orderApi } = await build(em)
            orderApi.getBuyerStatus.mockRejectedValue(new Error("order service unavailable"))

            await expect(accounts.overview({ personId: "p-1", sessionToken: "t-1" })).rejects.toThrow(
                "order service unavailable",
            )
        })

        it("joins the account with the buyer status the order service reports", async () => {
            const em = mockEntityManager({ findOneBy: [PersonEntity, person("p-1", "an@shop.test", "s3cret-pw")] })
            const { accounts, orderApi } = await build(em)
            orderApi.getBuyerStatus.mockResolvedValue({ personId: "p-1", hasOrders: true })

            expect(await accounts.overview({ personId: "p-1", sessionToken: "t-1" })).toSucceedWith({
                personId: "p-1",
                email: "an@shop.test",
                hasOrders: true,
            })
            expect(orderApi.getBuyerStatus).toHaveBeenCalledWith("t-1")
        })

        it("refuses an unknown person without asking the order service", async () => {
            const { accounts, orderApi } = await build(mockEntityManager({ findOneBy: [PersonEntity, null] }))

            expect(await accounts.overview({ personId: "p-9", sessionToken: "t-1" })).toBeRefused(
                AccountErrorCode.PersonUnknown,
            )
            expect(orderApi.getBuyerStatus).not.toHaveBeenCalled()
        })
    })
})
