import { afterEach, describe, expect, it, vi } from "vitest"
import { request } from "./client"

const answer = (status: number, body: unknown = {}) => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })))

afterEach(() => vi.unstubAllGlobals())

describe("request", () => {
    it("answers ok with the body left unknown", async () => {
        answer(200, { id: 1 })
        await expect(request({ url: "http://api.test/one" })).resolves.toEqual({ kind: "ok", data: { id: 1 } })
    })

    it.each([
        [401, "refused"],
        [403, "refused"],
        [404, "not-found"],
        [400, "invalid"],
        [422, "invalid"],
        [500, "unavailable"],
    ])("answers %i as %s", async (status, kind) => {
        answer(status)
        await expect(request({ url: "http://api.test/one" })).resolves.toEqual({ kind })
    })

    it("answers unavailable when the network fails or the body is not JSON", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")))
        await expect(request({ url: "http://api.test/one" })).resolves.toEqual({ kind: "unavailable" })
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })))
        await expect(request({ url: "http://api.test/one" })).resolves.toEqual({ kind: "unavailable" })
    })

    it("sends the JSON body with a signal", async () => {
        const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
        vi.stubGlobal("fetch", fetcher)
        await request({ url: "http://api.test/one", method: "POST", body: { a: 1 } })
        const init = fetcher.mock.calls[0]?.[1] as RequestInit
        expect(init.method).toBe("POST")
        expect(init.body).toBe('{"a":1}')
        expect(init.signal).toBeInstanceOf(AbortSignal)
    })
})
