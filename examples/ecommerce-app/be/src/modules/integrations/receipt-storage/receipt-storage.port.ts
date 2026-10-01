import type { ReceiptLink, StoreReceiptParams } from "./receipt-storage.contracts"

/** The receipt archive: a private bucket the buyer reads only through a time-limited link. */
export interface ReceiptStorage {
    /** Stores the receipt document under its key, replacing an earlier copy. */
    store(params: StoreReceiptParams): Promise<void>
    /** A presigned download link of the stored receipt; signing needs no call to the storage. */
    linkOf(key: string): ReceiptLink
}
