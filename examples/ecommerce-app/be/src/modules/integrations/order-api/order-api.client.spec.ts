import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { OrderApiErrorCode } from "./errors/order-api.error"
import { OrderApiClient } from "./order-api.client"
import { ORDER_API_DOCUMENTS } from "./order-api.contracts"
import { MODULE_OPTIONS_TOKEN } from "./order-api.module-definition"
import type { OrderApiOptions } from "./order-api.options"

const options: OrderApiOptions = { url: "http://order.test", timeoutMs: 3000 }

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            OrderApiClient,
            { provide: HTTP_CLIENT, useValue: http },
            { provide: MODULE_OPTIONS_TOKEN, useValue: options },
        ],
    }).compile()
    return { client: moduleRef.get(OrderApiClient), http }
}

describe("OrderApiClient", () => {
    describe("getBuyerStatus", () => {
        it.each([true, false])("forwards the bearer token and returns hasOrders=%s", async (hasOrders) => {
            const { client, http } = await build()
            http.request.mockResolvedValue({
                status: 200,
                body: { data: { buyerStatus: { personId: "person-1", hasOrders } } },
            })

            await expect(client.getBuyerStatus("session-token")).resolves.toEqual({
                personId: "person-1",
                hasOrders,
            })

            expect(http.request).toHaveBeenCalledWith({
                method: "POST",
                url: "http://order.test/graphql",
                headers: { authorization: "Bearer session-token" },
                body: { query: ORDER_API_DOCUMENTS.buyerStatus, variables: undefined },
                timeoutMs: 3000,
            })
        })

        it("maps GraphQL error codes to unavailable and keeps every code in the reason", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({
                status: 200,
                body: {
                    errors: [{ extensions: { code: "UNAUTHENTICATED" } }, { extensions: { code: "INTERNAL" } }],
                },
            })

            await expect(client.getBuyerStatus("session-token")).rejects.toMatchObject({
                code: OrderApiErrorCode.Unavailable,
                params: { reason: "UNAUTHENTICATED,INTERNAL" },
            })
        })

        it.each([
            ["a non-GraphQL body", "not-an-object"],
            ["missing data", {}],
            ["a missing buyer status", { data: {} }],
            ["a non-object buyer status", { data: { buyerStatus: "person-1" } }],
            ["a non-string person id", { data: { buyerStatus: { personId: 1, hasOrders: true } } }],
            ["a non-boolean order flag", { data: { buyerStatus: { personId: "person-1", hasOrders: "yes" } } }],
        ])("reports contract mismatch for %s", async (_case, body) => {
            const { client, http } = await build()
            http.request.mockResolvedValue({ status: 200, body })

            await expect(client.getBuyerStatus("session-token")).rejects.toMatchObject({
                code: OrderApiErrorCode.ContractMismatch,
            })
        })

        it("maps a transport failure to unavailable", async () => {
            const { client, http } = await build()
            const failure = new Error("order service timed out")
            http.request.mockRejectedValue(failure)

            await expect(client.getBuyerStatus("session-token")).rejects.toMatchObject({
                code: OrderApiErrorCode.Unavailable,
                cause: failure,
            })
        })
    })
})
