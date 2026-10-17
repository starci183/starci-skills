import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { HttpClient } from "./http.port"
import { callGraphql } from "./graphql-call.mapper"

const SUBJECT: unique symbol = Symbol("http/graphql-call.mapper")
const subjectFunctions = () => ({ callGraphql })

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: subjectFunctions }],
    }).compile()
    return moduleRef.get<ReturnType<typeof subjectFunctions>>(SUBJECT)
}

describe("callGraphql", () => {
    it("sends the operation and reads its data and string error codes", async () => {
        const subject = await build()

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
            subject.callGraphql(http, {
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
        const subject = await build()

        const http = mock<HttpClient>()
        http.request.mockResolvedValue({ status: 200, body: { data: "malformed", errors: {} } })

        await expect(
            subject.callGraphql(http, {
                url: "https://order.test/graphql",
                query: "query Health { health }",
                timeoutMs: 1000,
            }),
        ).resolves.toEqual({ data: undefined, errorCodes: [] })
    })

    it.each([undefined, null, "not a response"])(
        "returns null when the response body is not an object (%p)",
        async (body) => {
            const subject = await build()

            const http = mock<HttpClient>()
            http.request.mockResolvedValue({ status: 502, body })

            await expect(
                subject.callGraphql(http, {
                    url: "https://order.test/graphql",
                    query: "query Health { health }",
                    timeoutMs: 1000,
                }),
            ).resolves.toBeNull()
        },
    )
})
