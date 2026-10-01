import type {
    ScanUploadParams,
    ScanVerdict,
    StoredBytesResult,
    StoreUploadParams,
    UploadObjectParams,
} from "./upload-storage.contracts"

/**
 * The byte plane: store, get and delete one object. Implementations own durability and containment; the object key is
 * derived from the upload id, never from client input. The dev stack answers with the local filesystem; an object
 * store implements the same three verbs.
 */
export interface UploadStorage {
    /**
     * Writes the object, replacing any earlier bytes, and has the content inspected; an object the inspection rejects
     * is removed again. Rejects with an UploadStorageError when the bytes cannot be written.
     */
    store(params: StoreUploadParams): Promise<ScanVerdict>
    /** Reads the object, or null when nothing is stored for the upload. */
    get(params: UploadObjectParams): Promise<StoredBytesResult>
    /** Removes the object; a missing object is not a failure. */
    delete(params: UploadObjectParams): Promise<void>
}

/**
 * The content inspection hook, called once per stored object before its row turns ready. A real scanner replaces the
 * shipped implementation without touching the handlers; an infrastructure failure rejects, a verdict never does.
 */
export interface UploadScan {
    /** Votes on the stored object. */
    scan(params: ScanUploadParams): Promise<ScanVerdict>
}
