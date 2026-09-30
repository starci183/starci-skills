import { createServer } from "node:http"
import type { Server } from "node:http"
import { FetchHttpClient } from "./fetch-http-client.client"
import { HttpError, HttpErrorCode } from "./errors/http.error"

const listen = (handler: Parameters<typeof createServer>[1]): Promise<{ server: Server; url: string }> =>
    new Promise((resolve) => {
        const server = createServer(handler)
        server.listen(0, "127.0.0.1", () => {
            const address = server.address()
            const port = address && typeof address === "object" ? address.port : 0
            resolve({ server, url: `http://127.0.0.1:${port}` })
        })
    })

const close = (server: Server): Promise<void> => new Promise((resolve) => server.close(() => resolve()))

describe("FetchHttpClient", () => {
    it("sends a JSON body and parses the JSON answer", async () => {
        const seen: Array<string> = []
        const { server, url } = await listen((request, response) => {
            request.on("data", (chunk: Buffer) => seen.push(chunk.toString()))
            request.on("end", () => {
                response.setHeader("content-type", "application/json")
                response.end(JSON.stringify({ echoed: seen.join("") }))
            })
        })
        const answer = await new FetchHttpClient().request({ method: "POST", url, body: { a: 1 }, timeoutMs: 2000 })
        await close(server)
        expect(answer.status).toBe(200)
        expect(answer.body).toEqual({ echoed: '{"a":1}' })
    })

    it("sends form fields as a urlencoded body with the form content type", async () => {
        const seen: Array<string> = []
        const types: Array<string | undefined> = []
        const { server, url } = await listen((request, response) => {
            types.push(request.headers["content-type"])
            request.on("data", (chunk: Buffer) => seen.push(chunk.toString()))
            request.on("end", () => {
                response.setHeader("content-type", "application/json")
                response.end(JSON.stringify({ ok: true }))
            })
        })
        await new FetchHttpClient().request({ method: "POST", url, form: { grant_type: "password", username: "a b" }, timeoutMs: 2000 })
        await close(server)
        expect(types).toEqual(["application/x-www-form-urlencoded"])
        expect(seen.join("")).toBe("grant_type=password&username=a+b")
    })

    it("fails as a timeout when the other side is too slow", async () => {
        const { server, url } = await listen(() => undefined)
        const call = new FetchHttpClient().request({ method: "GET", url, timeoutMs: 50 })
        await expect(call).rejects.toMatchObject({ code: HttpErrorCode.Timeout })
        server.closeAllConnections()
        await close(server)
    })

    it("fails as a network error when nothing listens", async () => {
        const call = new FetchHttpClient().request({ method: "GET", url: "http://127.0.0.1:1", timeoutMs: 500 })
        await expect(call).rejects.toBeInstanceOf(HttpError)
        await expect(call).rejects.toMatchObject({ code: HttpErrorCode.Network })
    })

    it("fails when the body is not JSON", async () => {
        const { server, url } = await listen((_request, response) => response.end("not json"))
        const call = new FetchHttpClient().request({ method: "GET", url, timeoutMs: 2000 })
        await expect(call).rejects.toMatchObject({ code: HttpErrorCode.BodyUnreadable })
        await close(server)
    })
})
