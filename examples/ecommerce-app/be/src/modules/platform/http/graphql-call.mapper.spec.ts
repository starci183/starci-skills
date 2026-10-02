import { mock } from "@starci/jest-preset"
import type { HttpClient } from "./http.port"
import { callGraphql } from "./graphql-call.mapper"

describe("callGraphql", () => {
    it("sends the operation and reads its data and string error codes", async () => {
        const http = mock<HttpClient>()
        http.request.mockResolvedValue({
            status: 200,
            body: {
                data: { order: { id: "order-1" } },
                errors: [
                    { extensions: { code: "ORDER_STALE" } },
                    { extensions: { code: 7 } },
                    { extensions: null },
                    "malformed",
                ],
            },
        })

        await expect(
            callGraphql(http, {
                url: "https://order.test/graphql",
                query: "query Order($id: ID!) { order(id: $id) { id } }",
                variables: { id: "order-1" },
                headers: { authorization: "Bearer token" },
                timeoutMs: 2500,
            }),
        ).resolves.toEqual({ data: { order: { id: "order-1" } }, errorCodes: ["ORDER_STALE"] })

        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: "https://order.test/graphql",
            headers: { authorization: "Bearer token" },
            body: {
                query: "query Order($id: ID!) { order(id: $id) { id } }",
                variables: { id: "order-1" },
            },
            timeoutMs: 2500,
        })
    })

    it("returns an empty answer when data and errors do not have GraphQL shapes", async () => {
        const http = mock<HttpClient>()
        http.request.mockResolvedValue({ status: 200, body: { data: "malformed", errors: {} } })

        await expect(
            callGraphql(http, { url: "https://order.test/graphql", query: "query Health { health }", timeoutMs: 1000 }),
        ).resolves.toEqual({ data: undefined, errorCodes: [] })
    })

    it.each([undefined, null, "not a response"])(
        "returns null when the response body is not an object (%p)",
        async (body) => {
            const http = mock<HttpClient>()
            http.request.mockResolvedValue({ status: 502, body })

            await expect(
                callGraphql(http, {
                    url: "https://order.test/graphql",
                    query: "query Health { health }",
                    timeoutMs: 1000,
                }),
            ).resolves.toBeNull()
        },
    )
})
