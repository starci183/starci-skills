import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { withLock } from "./lock"

/** Repository to tag to the epoch milliseconds the tag was first seen: content hashes carry no order, so the ledger is the order. */
export type LedgerData = Record<string, Record<string, number>>

/** The image tag ledger (`<home>/cluster/images.json`), updated under its own lock. */
export interface ImageLedger {
    read(): Promise<LedgerData>
    /** Reads, applies `mutate`, writes back; serialised across processes. */
    update<T>(mutate: (data: LedgerData) => T): Promise<T>
}

const readData = async (file: string): Promise<LedgerData> => {
    try {
        const parsed: unknown = JSON.parse(await readFile(file, "utf8"))
        return typeof parsed === "object" && parsed !== null ? (parsed as LedgerData) : {}
    } catch {
        return {}
    }
}

/** Creates the ledger stored at `file`, locked by the directory `lockDir`. */
export const createLedger = (file: string, lockDir: string): ImageLedger => ({
    read: () => readData(file),
    update: (mutate) =>
        withLock(lockDir, async () => {
            const data = await readData(file)
            const result = mutate(data)
            await mkdir(dirname(file), { recursive: true })
            await writeFile(file, JSON.stringify(data, null, 2))
            return result
        }),
})
