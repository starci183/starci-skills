import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { HTTP_CLIENT, HttpError, HttpErrorCode } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { isRunKey } from "@modules/platform/jobs/jobs.contracts"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReceiptStorageErrorCode } from "./errors/receipt-storage.error"
import { RECEIPT_STORAGE_OPTIONS } from "./receipt-storage.decorators"
import { ReceiptStorageLogEvent } from "./receipt-storage.log-events"
import type { ReceiptStorageOptions } from "./receipt-storage.options"
import { S3ReceiptStorageClient } from "./s3-receipt-storage.client"

const AT = "2026-10-01T12:00:00.000Z"
const RUN_KEY_TEXT = "job-1:store-receipt:7"
if (!isRunKey(RUN_KEY_TEXT)) throw new Error("the test run key must be valid")
const RUN_KEY = RUN_KEY_TEXT

const options: ReceiptStorageOptions = {
    endpoint: "https://s3.example.test///",
    region: "ap-southeast-1",
    bucket: "private-receipts",
    accessKeyId: "AKID",
    secretAccessKey: new Secret("secret-key"),
    linkTtlMs: 900_000,
    timeoutMs: 3000,
}

const receipt = { key: "receipts/order-1.json", content: Buffer.from('{"orderId":"order-1"}') }

const build = async () => {
    const http = mock<HttpClient>()
    const logger = mock<Logger>()
    const clock = new FakeClock(AT)
    const moduleRef = await Test.createTestingModule({
        providers: [
            S3ReceiptStorageClient,
            { provide: RECEIPT_STORAGE_OPTIONS, useValue: options },
            { provide: HTTP_CLIENT, useValue: http },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { client: moduleRef.get(S3ReceiptStorageClient), http, logger, clock }
}

describe("S3ReceiptStorageClient", () => {
    describe("store", () => {
        it("signs and stores the exact receipt bytes, then records the completed run", async () => {
            const { client, http, logger } = await build()
            http.request.mockResolvedValue({ status: 200, body: Buffer.alloc(0) })

            await client.store(receipt, RUN_KEY)

            expect(http.request).toHaveBeenCalledWith({
                method: "PUT",
                url: "https://s3.example.test/private-receipts/receipts/order-1.json",
                headers: {
                    "x-amz-date": "20261001T120000Z",
                    "x-amz-content-sha256": expect.stringMatching(/^[0-9a-f]{64}$/),
                    authorization: expect.stringMatching(/^AWS4-HMAC-SHA256 /),
                    "content-type": "application/json",
                },
                bytes: receipt.content,
                read: "bytes",
                timeoutMs: 3000,
            })
            expect(logger.info).toHaveBeenCalledWith(ReceiptStorageLogEvent.Stored, {
                key: receipt.key,
                runKey: RUN_KEY,
            })
        })

        it("creates a missing bucket without a body and retries the object write", async () => {
            const { client, http } = await build()
            http.request
                .mockResolvedValueOnce({ status: 404, body: Buffer.alloc(0) })
                .mockResolvedValueOnce({ status: 200, body: Buffer.alloc(0) })
                .mockResolvedValueOnce({ status: 204, body: Buffer.alloc(0) })

            await client.store(receipt, RUN_KEY)

            expect(http.request).toHaveBeenNthCalledWith(2, {
                method: "PUT",
                url: "https://s3.example.test/private-receipts",
                headers: {
                    "x-amz-date": "20261001T120000Z",
                    "x-amz-content-sha256": expect.stringMatching(/^[0-9a-f]{64}$/),
                    authorization: expect.stringMatching(/^AWS4-HMAC-SHA256 /),
                },
                read: "bytes",
                timeoutMs: 3000,
            })
            expect(http.request).toHaveBeenNthCalledWith(
                3,
                expect.objectContaining({ url: "https://s3.example.test/private-receipts/receipts/order-1.json" }),
            )
        })

        it("accepts a bucket-create conflict and retries the object write", async () => {
            const { client, http } = await build()
            http.request
                .mockResolvedValueOnce({ status: 404, body: Buffer.alloc(0) })
                .mockResolvedValueOnce({ status: 409, body: Buffer.alloc(0) })
                .mockResolvedValueOnce({ status: 200, body: Buffer.alloc(0) })

            await expect(client.store(receipt, RUN_KEY)).resolves.toBeUndefined()

            expect(http.request).toHaveBeenCalledTimes(3)
        })

        it("reports a refused bucket creation once", async () => {
            const { client, http, logger } = await build()
            http.request
                .mockResolvedValueOnce({ status: 404, body: Buffer.alloc(0) })
                .mockResolvedValueOnce({ status: 503, body: Buffer.alloc(0) })

            await expect(client.store(receipt, RUN_KEY)).rejects.toMatchObject({
                code: ReceiptStorageErrorCode.Unavailable,
                params: { reason: "http-503" },
            })

            expect(logger.error).toHaveBeenCalledWith(ReceiptStorageLogEvent.StoreFailed, "http-503", {
                key: receipt.key,
                reason: "http-503",
            })
        })

        it("reports a refused retry after creating the bucket", async () => {
            const { client, http } = await build()
            http.request
                .mockResolvedValueOnce({ status: 404, body: Buffer.alloc(0) })
                .mockResolvedValueOnce({ status: 200, body: Buffer.alloc(0) })
                .mockResolvedValueOnce({ status: 500, body: Buffer.alloc(0) })

            await expect(client.store(receipt, RUN_KEY)).rejects.toMatchObject({
                code: ReceiptStorageErrorCode.Unavailable,
                params: { reason: "http-500" },
            })
        })

        it("reports an unexpected object status without trying to create the bucket", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({ status: 403, body: Buffer.alloc(0) })

            await expect(client.store(receipt, RUN_KEY)).rejects.toMatchObject({
                code: ReceiptStorageErrorCode.Unavailable,
                params: { reason: "http-403" },
            })

            expect(http.request).toHaveBeenCalledTimes(1)
        })

        it.each([
            ["a timeout", new HttpError({ code: HttpErrorCode.Timeout }), "timeout"],
            ["another HTTP failure", new HttpError({ code: HttpErrorCode.Network }), "unreachable"],
            ["an unexpected transport failure", new Error("socket closed"), "unreachable"],
        ])("maps %s to storage unavailable", async (_case, failure, reason) => {
            const { client, http, logger } = await build()
            http.request.mockRejectedValue(failure)

            await expect(client.store(receipt, RUN_KEY)).rejects.toMatchObject({
                code: ReceiptStorageErrorCode.Unavailable,
                params: { reason },
                cause: failure,
            })

            expect(logger.error).toHaveBeenCalledWith(ReceiptStorageLogEvent.StoreFailed, failure, {
                key: receipt.key,
                reason,
            })
        })
    })

    describe("linkOf", () => {
        it("returns a presigned link and the exact configured expiry instant", async () => {
            const { client } = await build()

            const link = client.linkOf(receipt.key)

            expect(link.expiresAt).toEqual(new Date("2026-10-01T12:15:00.000Z"))
            expect(link.url).toContain("https://s3.example.test/private-receipts/receipts/order-1.json?")
            expect(link.url).toContain("X-Amz-Date=20261001T120000Z")
            expect(link.url).toContain("X-Amz-Expires=900")
            expect(link.url).toMatch(/&X-Amz-Signature=[0-9a-f]{64}$/)
        })
    })
})
