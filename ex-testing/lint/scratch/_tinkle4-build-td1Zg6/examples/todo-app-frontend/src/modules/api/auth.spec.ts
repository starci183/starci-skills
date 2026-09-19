import { describe, expect, it, vi, beforeEach } from "vitest"
import * as graphqlModule from "./graphql"
import { signIn, signOut, SIGN_IN_REFUSAL_MESSAGE } from "./auth"

vi.mock("./graphql", async () => {
    const actual = await vi.importActual<typeof graphqlModule>("./graphql")
    return { ...actual, graphql: vi.fn() }
})

const mockedGraphql = () => graphqlModule.graphql as unknown as ReturnType<typeof vi.fn>

describe("signIn", () => {
    beforeEach(() => {
        mockedGraphql().mockReset()
    })

    it("returns the session token on a successful sign-in", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: true, data: { sessionToken: "tok-1", personId: "p-1" } })

        const result = await signIn("demo@todo.dev", "todo-demo-pass")

        expect(result).toEqual({ token: "tok-1" })
        expect(mockedGraphql()).toHaveBeenCalledWith(
            expect.stringContaining("signIn"),
            { input: { email: "demo@todo.dev", password: "todo-demo-pass" } },
        )
    })

    it("collapses a wrong-password refusal to the one uniform message (br.login.password.sign-in)", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: false, reason: "The email or password is incorrect.", code: "INVALID_CREDENTIALS" })

        await expect(signIn("demo@todo.dev", "not-it")).rejects.toThrow(SIGN_IN_REFUSAL_MESSAGE)
    })

    it("collapses an unknown-email refusal to the exact same message as a wrong password", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: false, reason: "The email or password is incorrect.", code: "INVALID_CREDENTIALS" })

        await expect(signIn("nobody@todo.dev", "anything")).rejects.toThrow(SIGN_IN_REFUSAL_MESSAGE)
    })
})

describe("signOut", () => {
    beforeEach(() => {
        mockedGraphql().mockReset()
    })

    it("reports true when the backend acknowledges the sign-out", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: true, data: { signedOut: true } })

        await expect(signOut("tok-1")).resolves.toBe(true)
        expect(mockedGraphql()).toHaveBeenCalledWith(expect.stringContaining("signOut"), { input: { sessionToken: "tok-1" } })
    })

    it("reports false rather than throwing when the transport refuses", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: false, reason: "network", code: "NETWORK" })

        await expect(signOut("tok-1")).resolves.toBe(false)
    })
})
