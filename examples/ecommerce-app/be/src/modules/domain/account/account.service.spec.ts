import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { SESSION_SERVICE } from "@modules/domain/session"
import type { SessionService } from "@modules/domain/session"
import { KEYCLOAK, KeycloakError, KeycloakErrorCode } from "@modules/integrations/keycloak"
import type { KeycloakClient } from "@modules/integrations/keycloak"
import { KEYCLOAK_ADMIN, KeycloakAdminErrorCode } from "@modules/integrations/keycloak-admin"
import type { KeycloakAdmin } from "@modules/integrations/keycloak-admin"
import { ORDER_API } from "@modules/integrations/order-api"
import type { OrderApiClient } from "@modules/integrations/order-api"
import { IDENTITY_ENTITY_MANAGER } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import { Test } from "@nestjs/testing"
import { personRow } from "@tests/fixtures/builders/account.builder"
import { AccountService } from "./account.service"
import { AccountErrorCode } from "./errors/account.error"
import { INSERT_PERSON_IF_NEW } from "./persistence/account.sql"
import { PersonEntity } from "./persistence/entities/person.entity"

const CREDENTIALS = { email: "an@shop.test", password: "s3cret-pw" }

const build = async (entityManager: MockEntityManager) => {
    const sessions = mock<SessionService>()
    const keycloak = mock<KeycloakClient>()
    const keycloakAdmin = mock<KeycloakAdmin>()
    const orderApi = mock<OrderApiClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountService,
            { provide: IDENTITY_ENTITY_MANAGER, useValue: entityManager },
            { provide: SESSION_SERVICE, useValue: sessions },
            { provide: KEYCLOAK, useValue: keycloak },
            { provide: KEYCLOAK_ADMIN, useValue: keycloakAdmin },
            { provide: ORDER_API, useValue: orderApi },
        ],
    }).compile()
    return { accounts: moduleRef.get(AccountService), sessions, keycloak, keycloakAdmin, orderApi }
}

describe("AccountService", () => {
    describe("register", () => {
        it("creates the shopper in the realm and records the person under the subject it was given", async () => {
            const em = mockEntityManager({ query: [INSERT_PERSON_IF_NEW, []] })
            const { accounts, keycloakAdmin } = await build(em)
            keycloakAdmin.createMember.mockResolvedValue(ok({ id: "kc-7" }))

            expect(await accounts.register(CREDENTIALS)).toSucceedWith({ personId: "kc-7" })

            expect(keycloakAdmin.createMember).toHaveBeenCalledWith(CREDENTIALS)
            expect(em.query).toHaveBeenCalledWith(INSERT_PERSON_IF_NEW, ["kc-7", "an@shop.test"])
        })

        it.each([
            [KeycloakAdminErrorCode.EmailTaken, AccountErrorCode.EmailTaken],
            [KeycloakAdminErrorCode.Unavailable, AccountErrorCode.ProviderUnavailable],
        ])("tells the realm's %s as %s and records nothing", async (providerCode, accountCode) => {
            const em = mockEntityManager()
            const { accounts, keycloakAdmin } = await build(em)
            keycloakAdmin.createMember.mockResolvedValue(refused(providerCode))

            expect(await accounts.register(CREDENTIALS)).toBeRefused(accountCode)

            expect(em.query).not.toHaveBeenCalled()
        })
    })

    describe("signIn", () => {
        it("signs in with the realm's password grant, records the person and opens a session keeping the refresh token", async () => {
            const em = mockEntityManager({ query: [INSERT_PERSON_IF_NEW, []] })
            const { accounts, keycloak, sessions } = await build(em)
            keycloak.signIn.mockResolvedValue({ subject: "kc-1", refreshToken: "refresh-1" })
            sessions.issue.mockResolvedValue({ sessionToken: "t-1", personId: "kc-1" })

            expect(await accounts.signIn(CREDENTIALS)).toSucceedWith({ sessionToken: "t-1", personId: "kc-1" })

            expect(keycloak.signIn).toHaveBeenCalledWith(CREDENTIALS)
            expect(em.query).toHaveBeenCalledWith(INSERT_PERSON_IF_NEW, ["kc-1", "an@shop.test"])
            expect(sessions.issue).toHaveBeenCalledWith({ personId: "kc-1", providerRefreshToken: "refresh-1" })
        })

        it.each([
            [KeycloakErrorCode.InvalidCredentials, AccountErrorCode.InvalidCredentials],
            [KeycloakErrorCode.ProviderUnavailable, AccountErrorCode.ProviderUnavailable],
        ])("tells the realm's %s as %s and opens no session", async (providerCode, accountCode) => {
            const em = mockEntityManager()
            const { accounts, keycloak, sessions } = await build(em)
            keycloak.signIn.mockRejectedValue(new KeycloakError({ code: providerCode }))

            expect(await accounts.signIn(CREDENTIALS)).toBeRefused(accountCode)

            expect(em.query).not.toHaveBeenCalled()
            expect(sessions.issue).not.toHaveBeenCalled()
        })

        it("rethrows a failure that is not the provider's", async () => {
            const { accounts, keycloak } = await build(mockEntityManager())
            keycloak.signIn.mockRejectedValue(new Error("bug"))

            await expect(accounts.signIn(CREDENTIALS)).rejects.toThrow("bug")
        })
    })

    describe("getAccount", () => {
        it("succeeds with the id and email", async () => {
            const em = mockEntityManager({
                findOneBy: [PersonEntity, personRow({ id: "kc-1", email: "an@shop.test" })],
            })
            const { accounts } = await build(em)

            expect(await accounts.getAccount({ personId: "kc-1" })).toSucceedWith({
                personId: "kc-1",
                email: "an@shop.test",
            })
            expect(em.findOneBy).toHaveBeenCalledWith(PersonEntity, { id: "kc-1" })
        })

        it("refuses a person that no longer exists", async () => {
            const { accounts } = await build(mockEntityManager({ findOneBy: [PersonEntity, null] }))

            expect(await accounts.getAccount({ personId: "kc-9" })).toBeRefused(AccountErrorCode.PersonUnknown)
        })
    })

    describe("overview", () => {
        it("fails with the order service error instead of answering hasOrders false", async () => {
            const em = mockEntityManager({ findOneBy: [PersonEntity, personRow({ id: "kc-1" })] })
            const { accounts, orderApi } = await build(em)
            orderApi.getBuyerStatus.mockRejectedValue(new Error("order service unavailable"))

            await expect(accounts.overview({ personId: "kc-1", sessionToken: "t-1" })).rejects.toThrow(
                "order service unavailable",
            )
        })

        it("joins the account with the buyer status the order service reports", async () => {
            const em = mockEntityManager({
                findOneBy: [PersonEntity, personRow({ id: "kc-1", email: "an@shop.test" })],
            })
            const { accounts, orderApi } = await build(em)
            orderApi.getBuyerStatus.mockResolvedValue({ personId: "kc-1", hasOrders: true })

            expect(await accounts.overview({ personId: "kc-1", sessionToken: "t-1" })).toSucceedWith({
                personId: "kc-1",
                email: "an@shop.test",
                hasOrders: true,
            })
            expect(orderApi.getBuyerStatus).toHaveBeenCalledWith("t-1")
        })

        it("refuses an unknown person without asking the order service", async () => {
            const { accounts, orderApi } = await build(mockEntityManager({ findOneBy: [PersonEntity, null] }))

            expect(await accounts.overview({ personId: "kc-9", sessionToken: "t-1" })).toBeRefused(
                AccountErrorCode.PersonUnknown,
            )
            expect(orderApi.getBuyerStatus).not.toHaveBeenCalled()
        })
    })
})
