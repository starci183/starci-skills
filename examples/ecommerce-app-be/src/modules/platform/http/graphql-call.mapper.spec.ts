import { mock } from "@starci/jest-preset/mock"
import { callGraphql } from "./graphql-call.mapper"
import type { HttpClient } from "./http.port"

const answering = (body: unknown): HttpClient =>
    mock<HttpClient>({ request: jest.fn().mockResolvedValue({ status: 200, body }) })

const call = { url: "http://x/graphql", query: "{ a }", timeoutMs: 100 }

describe("callGraphql", () => {
    it("posts the operation with its deadline and reads the data object", async () => {
        const http = answering({ data: { a: { id: "1" } } })
        await expect(
            callGraphql(http, { ...call, variables: { n: 1 }, headers: { authorization: "Bearer t" } }),
        ).resolves.toEqual({
            data: { a: { id: "1" } },
            errorCodes: [],
        })
        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: "http://x/graphql",
            headers: { authorization: "Bearer t" },
            body: { query: "{ a }", variables: { n: 1 } },
            timeoutMs: 100,
        })
    })

    it("collects the extension codes of the reported errors", async () => {
        const http = answering({
            errors: [{ message: "m", extensions: { code: "A" } }, { message: "no code" }, "junk"],
        })
        await expect(callGraphql(http, call)).resolves.toEqual({ data: undefined, errorCodes: ["A"] })
    })

    it("answers null when the body is not a GraphQL response", async () => {
        await expect(callGraphql(answering("<html>"), call)).resolves.toBeNull()
    })
})
