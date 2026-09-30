import { mock } from "@starci/jest-preset/mock"
import { Secret } from "@modules/platform/config"
import { HttpError, HttpErrorCode } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { SepayErrorCode } from "./errors/sepay.error"
import { SepayClient } from "./sepay.client"
import type { SepayOptions } from "./sepay.options"

const options: SepayOptions = {
    baseUrl: "http://sepay.test",
    apiKey: new Secret("api-key"),
    webhookSecret: new Secret("hook-secret"),
    timeoutMs: 250,
}

const answering = (body: unknown, status = 200): HttpClient =>
    mock<HttpClient>({ request: jest.fn().mockResolvedValue({ status, body }) })

const clientFor = (http: HttpClient): SepayClient => new SepayClient(http, options)

const failing = async (call: Promise<unknown>): Promise<Record<string, unknown>> => {
    const error: unknown = await call.then(
        () => undefined,
        (rejected: unknown) => rejected,
    )
    expect(error).toMatchObject({ code: SepayErrorCode.RequestFailed })
    return error instanceof Error && "params" in error && typeof error.params === "object" && error.params !== null
        ? { ...error.params }
        : {}
}

describe("SepayClient", () => {
    describe("createIntent", () => {
        it("posts the reference, amount and currency with the credential and the deadline, and carries the gateway ids through", async () => {
            const http = answering({ id: "g1", qrCodeUrl: "https://pay.test/g1" })
            const result = await clientFor(http).createIntent({ subscriptionId: "s1", amount: 99000, currency: "VND" })
            expect(result).toEqual({ gatewayIntentId: "g1", checkoutUrl: "https://pay.test/g1" })
            expect(http.request).toHaveBeenCalledWith({
                method: "POST",
                url: "http://sepay.test/userapi/transactions/qr",
                headers: { accept: "application/json", authorization: "Bearer api-key" },
                body: { reference: "s1", amount: 99000, currency: "VND" },
                timeoutMs: 250,
            })
        })

        it("refuses a success answer that names no transaction or an empty one", async () => {
            const params = { subscriptionId: "s1", amount: 1, currency: "VND" }
            await expect(failing(clientFor(answering({})).createIntent(params))).resolves.toMatchObject({ reason: "missing-intent" })
            await expect(
                failing(clientFor(answering({ id: "", qrCodeUrl: "https://pay.test" })).createIntent(params)),
            ).resolves.toMatchObject({ reason: "missing-intent" })
        })

        it("reports the gateway status of a failed call and never the credential", async () => {
            const params = await failing(
                clientFor(answering({ message: "bad" }, 401)).createIntent({ subscriptionId: "s1", amount: 1, currency: "VND" }),
            )
            expect(params).toEqual({ operation: "create-intent", reason: "http-401", status: 401 })
            expect(JSON.stringify(params)).not.toContain("api-key")
        })

        it("refuses an answer that is JSON but not an object", async () => {
            await expect(
                failing(clientFor(answering("plain")).createIntent({ subscriptionId: "s1", amount: 1, currency: "VND" })),
            ).resolves.toMatchObject({ reason: "not-an-object" })
        })
    })

    describe("getTransaction", () => {
        it("reads the status and the period end and keeps the id inside its own path segment", async () => {
            const http = answering({ status: "paid", periodEnd: "2026-10-30T00:00:00.000Z" })
            const result = await clientFor(http).getTransaction("a/b c")
            expect(result).toEqual({ status: "paid", periodEnd: new Date("2026-10-30T00:00:00.000Z") })
            expect(http.request).toHaveBeenCalledWith(
                expect.objectContaining({ method: "GET", url: "http://sepay.test/userapi/transactions/details/a%2Fb%20c" }),
            )
        })

        it("carries a failed status through and has no period end when the gateway names none", async () => {
            await expect(clientFor(answering({ status: "failed" })).getTransaction("g1")).resolves.toEqual({
                status: "failed",
                periodEnd: undefined,
            })
        })

        it("accepts an epoch-milliseconds period end", async () => {
            const epoch = Date.parse("2026-10-30T00:00:00.000Z")
            const result = await clientFor(answering({ status: "paid", periodEnd: epoch })).getTransaction("g1")
            expect(result.periodEnd).toEqual(new Date(epoch))
        })

        it("refuses a status outside the closed vocabulary rather than coercing it", async () => {
            await expect(failing(clientFor(answering({ status: "refunded" })).getTransaction("g1"))).resolves.toMatchObject({
                reason: "unknown-status",
            })
            await expect(failing(clientFor(answering({ status: 7 })).getTransaction("g1"))).resolves.toMatchObject({
                reason: "unknown-status",
            })
        })

        it("refuses a period end that is not a date", async () => {
            await expect(
                failing(clientFor(answering({ status: "paid", periodEnd: "soon" })).getTransaction("g1")),
            ).resolves.toMatchObject({ reason: "bad-period-end" })
            await expect(
                failing(clientFor(answering({ status: "paid", periodEnd: { at: 1 } })).getTransaction("g1")),
            ).resolves.toMatchObject({ reason: "bad-period-end" })
        })
    })

    describe("transport failures", () => {
        const rejecting = (code: HttpErrorCode): HttpClient =>
            mock<HttpClient>({ request: jest.fn().mockRejectedValue(new HttpError({ code })) })

        it("reports a gateway that never answers as a timeout", async () => {
            await expect(failing(clientFor(rejecting(HttpErrorCode.Timeout)).getTransaction("g1"))).resolves.toEqual({
                operation: "get-transaction",
                reason: "timeout",
            })
        })

        it("reports an unreachable gateway and an unreadable body, keeping the cause", async () => {
            await expect(failing(clientFor(rejecting(HttpErrorCode.Network)).getTransaction("g1"))).resolves.toMatchObject({
                reason: "unreachable",
            })
            await expect(failing(clientFor(rejecting(HttpErrorCode.BodyUnreadable)).getTransaction("g1"))).resolves.toMatchObject({
                reason: "not-json",
            })
            const call = clientFor(rejecting(HttpErrorCode.Network)).getTransaction("g1")
            await expect(call).rejects.toMatchObject({ cause: expect.any(HttpError) })
        })
    })
})
