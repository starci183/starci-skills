import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HttpErrorCode } from "./errors/http.error"
import { FetchHttpClient } from "./fetch-http-client.client"

const build = async (): Promise<FetchHttpClient> => {
    const moduleRef = await Test.createTestingModule({ providers: [FetchHttpClient] }).compile()
    return moduleRef.get(FetchHttpClient)
}

const responseOf = (status = 200) => mock<Response>({ status })

describe("FetchHttpClient", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("sends a JSON request and parses its JSON response", async () => {
        const client = await build()
        const response = responseOf(201)
        response.text.mockResolvedValue('{"created":true}')
        const send = jest.spyOn(global, "fetch").mockResolvedValue(response)

        await expect(
            client.request({
                method: "POST",
                url: "https://service.test/orders",
                headers: { authorization: "Bearer token" },
                body: { orderId: "order-1" },
                timeoutMs: 2500,
            }),
        ).resolves.toEqual({ status: 201, body: { created: true } })

        expect(send).toHaveBeenCalledWith("https://service.test/orders", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: "Bearer token" },
            body: JSON.stringify({ orderId: "order-1" }),
            signal: expect.any(AbortSignal),
        })
    })

    it("returns undefined for an empty response body", async () => {
        const client = await build()
        const response = responseOf(204)
        response.text.mockResolvedValue("")
        jest.spyOn(global, "fetch").mockResolvedValue(response)

        await expect(
            client.request({ method: "GET", url: "https://service.test/health", timeoutMs: 2500 }),
        ).resolves.toEqual({ status: 204, body: undefined })

        expect(fetch).toHaveBeenCalledWith(
            "https://service.test/health",
            expect.objectContaining({ headers: {}, body: undefined }),
        )
    })

    it("encodes form fields and combines a caller cancellation signal with the deadline", async () => {
        const client = await build()
        const response = responseOf()
        response.text.mockResolvedValue("{}")
        const send = jest.spyOn(global, "fetch").mockResolvedValue(response)
        const caller = new AbortController()

        await client.request({
            method: "POST",
            url: "https://service.test/token",
            form: { grant_type: "client_credentials", scope: "orders read" },
            timeoutMs: 2500,
            signal: caller.signal,
        })

        expect(send).toHaveBeenCalledWith(
            "https://service.test/token",
            expect.objectContaining({
                headers: { "content-type": "application/x-www-form-urlencoded" },
                body: "grant_type=client_credentials&scope=orders+read",
                signal: expect.any(AbortSignal),
            }),
        )
        expect(send.mock.calls[0]?.[1]?.signal).not.toBe(caller.signal)
    })

    it("sends and receives raw bytes", async () => {
        const client = await build()
        const response = responseOf(206)
        response.arrayBuffer.mockResolvedValue(Uint8Array.from([4, 5, 6]).buffer)
        const send = jest.spyOn(global, "fetch").mockResolvedValue(response)
        const bytes = Buffer.from([1, 2, 3])

        await expect(
            client.request({
                method: "PUT",
                url: "https://service.test/object",
                bytes,
                read: "bytes",
                timeoutMs: 2500,
            }),
        ).resolves.toEqual({ status: 206, body: Buffer.from([4, 5, 6]) })

        expect(send).toHaveBeenCalledWith(
            "https://service.test/object",
            expect.objectContaining({ headers: { "content-type": "application/octet-stream" }, body: bytes }),
        )
    })

    it("reports a response that is not JSON", async () => {
        const client = await build()
        const response = responseOf()
        response.text.mockResolvedValue("not JSON")
        jest.spyOn(global, "fetch").mockResolvedValue(response)

        await expect(
            client.request({ method: "GET", url: "https://service.test/orders", timeoutMs: 2500 }),
        ).rejects.toMatchObject({ code: HttpErrorCode.BodyUnreadable, cause: expect.any(SyntaxError) })
    })

    it("maps a failure before headers to a network error", async () => {
        const client = await build()
        jest.spyOn(global, "fetch").mockRejectedValue("connection refused")

        await expect(
            client.request({ method: "GET", url: "https://service.test/orders", timeoutMs: 2500 }),
        ).rejects.toMatchObject({ code: HttpErrorCode.Network, cause: "connection refused" })
    })

    it("maps a deadline failure before headers to a timeout", async () => {
        const client = await build()
        const failure = { name: "TimeoutError" }
        jest.spyOn(global, "fetch").mockRejectedValue(failure)

        await expect(
            client.request({ method: "GET", url: "https://service.test/orders", timeoutMs: 2500 }),
        ).rejects.toMatchObject({ code: HttpErrorCode.Timeout, cause: failure })
    })

    it("maps a failure while reading a response to a network error", async () => {
        const client = await build()
        const failure = new Error("stream cut")
        const response = responseOf()
        response.text.mockRejectedValue(failure)
        jest.spyOn(global, "fetch").mockResolvedValue(response)

        await expect(
            client.request({ method: "GET", url: "https://service.test/orders", timeoutMs: 2500 }),
        ).rejects.toMatchObject({ code: HttpErrorCode.Network, cause: failure })
    })

    it("maps a deadline while reading bytes to a timeout", async () => {
        const client = await build()
        const failure = { name: "TimeoutError" }
        const response = responseOf()
        response.arrayBuffer.mockRejectedValue(failure)
        jest.spyOn(global, "fetch").mockResolvedValue(response)

        await expect(
            client.request({
                method: "GET",
                url: "https://service.test/object",
                read: "bytes",
                timeoutMs: 2500,
            }),
        ).rejects.toMatchObject({ code: HttpErrorCode.Timeout, cause: failure })
    })
})
