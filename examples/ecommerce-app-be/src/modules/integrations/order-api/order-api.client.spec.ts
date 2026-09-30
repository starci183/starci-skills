import { mock } from "@starci/jest-preset/mock"
import { HttpError, HttpErrorCode } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { OrderApiErrorCode } from "./errors/order-api.error"
import { OrderApiClient } from "./order-api.client"

const options = { url: "http://order.test", timeoutMs: 250 }

const answering = (body: unknown): HttpClient => mock<HttpClient>({ request: jest.fn().mockResolvedValue({ status: 200, body }) })

const clientFor = (http: HttpClient): OrderApiClient => new OrderApiClient(http, options)

describe("OrderApiClient", () => {
    it("forwards the bearer token to the order GraphQL door and answers the buyer status", async () => {
        const http = answering({ data: { buyerStatus: { personId: "p-1", hasOrders: true } } })
        await expect(clientFor(http).getBuyerStatus("tok")).resolves.toEqual({ personId: "p-1", hasOrders: true })
        expect(http.request).toHaveBeenCalledWith(
            expect.objectContaining({
                url: "http://order.test/graphql",
                headers: { authorization: "Bearer tok" },
                timeoutMs: 250,
            }),
        )
    })

    it("fails as unavailable when the order service reports an error, never as hasOrders false", async () => {
        const http = answering({ errors: [{ message: "x", extensions: { code: "IDENTITY_API_UNAVAILABLE" } }] })
        await expect(clientFor(http).getBuyerStatus("tok")).rejects.toMatchObject({ code: OrderApiErrorCode.Unavailable })
    })

    it("fails as a contract mismatch when the answer has no buyer status", async () => {
        await expect(clientFor(answering({ data: {} })).getBuyerStatus("tok")).rejects.toMatchObject({
            code: OrderApiErrorCode.ContractMismatch,
        })
        await expect(clientFor(answering("<html>")).getBuyerStatus("tok")).rejects.toMatchObject({
            code: OrderApiErrorCode.ContractMismatch,
        })
    })

    it("fails as unavailable, keeping the cause, when the call itself fails", async () => {
        const cause = new HttpError({ code: HttpErrorCode.Network })
        const http = mock<HttpClient>({ request: jest.fn().mockRejectedValue(cause) })
        await expect(clientFor(http).getBuyerStatus("tok")).rejects.toMatchObject({ code: OrderApiErrorCode.Unavailable, cause })
    })
})
