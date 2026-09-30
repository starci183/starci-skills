import { describe, expect, it, vi, afterEach } from "vitest"
import { graphql, unwrap } from "./client"

describe("graphql", () => {
    const originalFetch = global.fetch

    afterEach(() => {
        global.fetch = originalFetch
        vi.restoreAllMocks()
    })

    it("sends the document, variables and an Authorization: Bearer <token> header, and unwraps the one top-level field", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            json: async () => ({ data: { tasks: [{ taskId: "t-1", title: "Ship it", complete: false }] } }),
        })
        global.fetch = fetchMock as unknown as typeof fetch

        const result = await graphql<unknown>("query { tasks { taskId } }", { foo: "bar" }, "token-1")

        expect(result).toEqual({ ok: true, data: [{ taskId: "t-1", title: "Ship it", complete: false }] })
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toContain("/graphql")
        expect(init.method).toBe("POST")
        expect(init.headers.authorization).toBe("Bearer token-1")
        expect(JSON.parse(init.body)).toEqual({ query: "query { tasks { taskId } }", variables: { foo: "bar" } })
    })

    it("omits the Authorization header when no token is given", async () => {
        const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ data: { signIn: { sessionToken: "x" } } }) })
        global.fetch = fetchMock as unknown as typeof fetch

        await graphql("mutation { signIn }")

        const [, init] = fetchMock.mock.calls[0]
        expect(init.headers.authorization).toBeUndefined()
    })

    it("turns a GraphQL error into a refused Result carrying its extensions.code", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            json: async () => ({ errors: [{ message: "The email or password is incorrect.", extensions: { code: "INVALID_CREDENTIALS" } }] }),
        })
        global.fetch = fetchMock as unknown as typeof fetch

        const result = await graphql("mutation { signIn }")

        expect(result).toEqual({ ok: false, reason: "The email or password is incorrect.", code: "INVALID_CREDENTIALS" })
    })

    it("never throws on a network failure; it resolves a refused Result instead", async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch

        const result = await graphql("query { tasks { taskId } }")

        expect(result).toEqual({ ok: false, reason: "network", code: "NETWORK" })
    })

    it("reports a malformed (non-JSON) response as a refused Result rather than throwing", async () => {
        global.fetch = vi.fn().mockResolvedValue({ json: async () => { throw new Error("not json") } }) as unknown as typeof fetch

        const result = await graphql("query { tasks { taskId } }")

        expect(result).toEqual({ ok: false, reason: "malformed", code: "MALFORMED" })
    })

    it("reports a response with no data field as empty", async () => {
        global.fetch = vi.fn().mockResolvedValue({ json: async () => ({}) }) as unknown as typeof fetch

        const result = await graphql("query { tasks { taskId } }")

        expect(result).toEqual({ ok: false, reason: "empty", code: "EMPTY" })
    })
})

describe("unwrap", () => {
    it("returns the payload of an ok result", () => {
        expect(unwrap({ ok: true, data: [1, 2] })).toEqual([1, 2])
    })

    it("throws the refusal's reason with its stable code on cause", () => {
        let thrown: unknown
        try {
            unwrap({ ok: false, reason: "The session is not active.", code: "SESSION_NOT_FOUND" })
        } catch (error) {
            thrown = error
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toBe("The session is not active.")
        expect(((thrown as Error).cause as Error).message).toBe("SESSION_NOT_FOUND")
    })

    it("throws without a cause when the refusal names no code", () => {
        expect(() => unwrap({ ok: false, reason: "empty" })).toThrow("empty")
    })
})
