import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { IdentityErrorCode } from "./errors/identity.error"
import { IDENTITY_OPTIONS } from "./identity.decorators"
import type { IdentityOptions } from "./identity.options"
import { ServiceKeyService } from "./service-key.service"

const ORDER_KEY = "order-key-of-the-spec"
const BILLING_KEY = "billing-key-of-the-spec"

const SERVICE_KEYS = { order: new Secret(ORDER_KEY), billing: new Secret(BILLING_KEY) }

const WITH_KEYS: IdentityOptions = { verifier: "verifier", serviceKeys: SERVICE_KEYS }

const build = async (options: IdentityOptions = WITH_KEYS) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ServiceKeyService, { provide: IDENTITY_OPTIONS, useValue: options }],
    }).compile()
    return moduleRef.get(ServiceKeyService)
}

const unauthenticated = { code: IdentityErrorCode.Unauthenticated }

describe("ServiceKeyService", () => {
    it.each([
        { caller: "the order service", key: ORDER_KEY, service: "order" },
        { caller: "the billing service", key: BILLING_KEY, service: "billing" },
    ])("names $caller as the api-key principal of the services workspace", async ({ key, service }) => {
        const authenticator = await build()

        await expect(authenticator.authenticate({ kind: "api-key" }, `Bearer ${key}`)).resolves.toEqual({
            kind: "api-key",
            subject: service,
            workspaceId: "services",
        })
    })

    it.each([
        { presented: "no authorization at all", authorization: "" },
        { presented: "a scheme other than bearer", authorization: `Basic ${ORDER_KEY}` },
        { presented: "an empty bearer", authorization: "Bearer   " },
        { presented: "a wrong key", authorization: "Bearer not-the-order-key" },
        { presented: "a key that only starts like a real one", authorization: `Bearer ${ORDER_KEY}x` },
    ])("refuses $presented as unauthenticated", async ({ authorization }) => {
        const authenticator = await build()

        await expect(authenticator.authenticate({ kind: "api-key" }, authorization)).rejects.toMatchObject(
            unauthenticated,
        )
    })

    it("refuses a right key on a door of another credential kind", async () => {
        const authenticator = await build()

        await expect(authenticator.authenticate({ kind: "tool-token" }, `Bearer ${ORDER_KEY}`)).rejects.toMatchObject(
            unauthenticated,
        )
    })

    it("fails closed when the app holds no service keys", async () => {
        const authenticator = await build({ verifier: "verifier" })

        await expect(authenticator.authenticate({ kind: "api-key" }, `Bearer ${ORDER_KEY}`)).rejects.toMatchObject(
            unauthenticated,
        )
    })

    it("refuses a key two services share, since it names no single service", async () => {
        const authenticator = await build({
            verifier: "verifier",
            serviceKeys: { order: new Secret(ORDER_KEY), billing: new Secret(ORDER_KEY) },
        })

        await expect(authenticator.authenticate({ kind: "api-key" }, `Bearer ${ORDER_KEY}`)).rejects.toMatchObject(
            unauthenticated,
        )
    })
})
