import { randomUUID } from "node:crypto"
import { RECEIPT_STORAGE, ReceiptStorageErrorCode } from "@modules/integrations/receipt-storage"
import type { ReceiptStorage } from "@modules/integrations/receipt-storage"
import type { RunKey } from "@modules/platform/jobs"
import { JOBS_CAPABILITY_MODULES, RECEIPT_STORAGE_CAPABILITY_MODULES } from "../../world/test-capabilities.options"
import { ProbeJobBehavior } from "../../world/probe-job.module"
import { useTestWorld } from "../../world/use-test-world"

/**
 * receipt-storage: the real S3 archive client against the run's own private bucket of the stack's MinIO, no HTTP door of
 * ours. A stored receipt downloads through its presigned link, byte for byte, until the link expires; the same object
 * without a signature is refused by the bucket, and a key nothing was stored under is absent. A storage that cannot be
 * reached is the declared storage-unavailable error, with the client storing again once MinIO is back.
 */
describe("receipt-storage: receipt archive client (integration)", () => {
    const world = useTestWorld({ modules: [...JOBS_CAPABILITY_MODULES, ...RECEIPT_STORAGE_CAPABILITY_MODULES] })

    const archive = (): ReceiptStorage => world.resolve<ReceiptStorage>(RECEIPT_STORAGE)
    /** The run key a storing job step passes: only a real claim of the job row makes one. */
    const runKeyOf = async (): Promise<RunKey> => {
        const claims = world.resolve(ProbeJobBehavior).claims
        const job = await world.waitFor("a job is claimed", () =>
            claims.claim({
                kind: "receipt-storage-spec",
                jobKey: randomUUID(),
                payload: {},
                workerId: "spec",
                leaseMs: 30_000,
            }),
        )
        return claims.runKey(job, "store")
    }
    const download = (url: string) => {
        const link = new URL(url)
        return world.http(link.origin).get<unknown>(`${link.pathname}${link.search}`)
    }

    it("stores a receipt that downloads through its presigned link and is refused without a signature", async () => {
        const key = `receipts/${randomUUID()}.json`
        const document = { orderId: randomUUID(), totalMinorUnits: 1250, currency: "USD" }

        await archive().store({ key, content: Buffer.from(JSON.stringify(document)) }, await runKeyOf())
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
        const runKey = await runKeyOf()

        await world.infra.minio.during(async () => {
            await expect(archive().store({ key, content: Buffer.from("{}") }, runKey)).rejects.toMatchObject({
                code: ReceiptStorageErrorCode.Unavailable,
            })
        })

        await archive().store({ key, content: Buffer.from("{}") }, runKey)
        expect((await download(archive().linkOf(key).url)).status).toBe(200)
    })
})
