import { randomUUID } from "node:crypto"
import { RECEIPT_STORAGE, ReceiptStorageErrorCode } from "@modules/integrations/receipt-storage"
import type { ReceiptStorage } from "@modules/integrations/receipt-storage"
import { RECEIPT_STORAGE_CAPABILITY_MODULES } from "../../world/test-capabilities.options"
import { useTestWorld } from "../../world/use-test-world"

/**
 * receipt-storage: the real S3 archive client against the run's own private bucket of the stack's MinIO, no HTTP door of
 * ours. A stored receipt downloads through its presigned link, byte for byte, until the link expires; the same object
 * without a signature is refused by the bucket, and a key nothing was stored under is absent. A storage that cannot be
 * reached is the declared storage-unavailable error, with the client storing again once MinIO is back.
 */
describe("receipt-storage: receipt archive client (integration)", () => {
    const world = useTestWorld({ modules: RECEIPT_STORAGE_CAPABILITY_MODULES })

    const archive = (): ReceiptStorage => world.resolve<ReceiptStorage>(RECEIPT_STORAGE)
    const download = (url: string) => {
        const link = new URL(url)
        return world.http(link.origin).get<unknown>(`${link.pathname}${link.search}`)
    }

    it("stores a receipt that downloads through its presigned link and is refused without a signature", async () => {
        const key = `receipts/${randomUUID()}.json`
        const document = { orderId: randomUUID(), totalMinorUnits: 1250, currency: "USD" }

        await archive().store({ key, content: Buffer.from(JSON.stringify(document)) })
        const link = archive().linkOf(key)

        const downloaded = await download(link.url)
        expect(downloaded.status).toBe(200)
        expect(downloaded.body).toEqual(document)
        const unsigned = await world.http(new URL(link.url).origin).get(new URL(link.url).pathname)
        expect(unsigned.status).toBe(403)
        expect((await download(archive().linkOf(`receipts/${randomUUID()}.json`).url)).status).toBe(404)
    })

    it("an unreachable storage is the declared storage-unavailable error, and the client stores again once MinIO is back", async () => {
        const key = `receipts/${randomUUID()}.json`

        await world.infra.minio.during(async () => {
            await expect(archive().store({ key, content: Buffer.from("{}") })).rejects.toMatchObject({
                code: ReceiptStorageErrorCode.Unavailable,
            })
        })

        await archive().store({ key, content: Buffer.from("{}") })
        expect((await download(archive().linkOf(key).url)).status).toBe(200)
    })
})
