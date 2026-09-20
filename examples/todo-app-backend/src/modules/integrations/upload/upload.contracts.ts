/**
 * integration.upload.local's two ports and the records the door hands back.
 *
 * `UploadStoragePort` is the byte-plane boundary: everything about where an object's bytes live hides
 * behind it. The dev stack's answer is the local filesystem (local-storage.adapter.ts); an S3/minio
 * adapter would implement the same three verbs and additionally mint real provider-presigned URLs at
 * the seam `UploadService.createIntent` documents. Capability code never sees a path, a bucket or an
 * SDK - only storage keys.
 *
 * `VirusScanPort` is the content-inspection boundary: `scan` returns when the object is acceptable and
 * throws `UploadScanRejectedException` when it is not. The shipped adapter is an explicit pass-through
 * (noop-virus-scan.adapter.ts) so the hook's contract - called after storage.put, a rejection deletes
 * the stored object and leaves the row pending - exists before a real scanner is wired in.
 */

/** The metadata row's lifecycle: an intent is `pending` until its bytes land, then `ready` forever; delete removes the row. */
export type UploadStatus = "pending" | "ready";

/** What a presigned-intent answer looks like to a client: the verb, the door, the credential header
 * and the expiry - deliberately the same shape an S3 presigned PUT returns, so swapping the storage
 * adapter changes only the url/host, never the client flow. */
export interface PresignedUpload {
  readonly uploadId: string;
  readonly method: "PUT";
  /** Where the client PUTs the bytes. The local adapter answers the api's own `/uploads/<id>/content`
   * door; a provider adapter would answer an absolute presigned URL instead. */
  readonly url: string;
  /** Headers the client must echo back on the PUT - the signed token travels here, never in a cookie. */
  readonly headers: Record<string, string>;
  readonly expiresAt: Date;
}

/** The metadata record the upload capability persists for every object - the row behind
 * data.upload.upload, returned to callers instead of the TypeORM entity. */
export class UploadRecord {
    constructor(
    public readonly id: string,
    public readonly owner: string,
    public readonly taskId: string | null,
    public readonly filename: string,
    public readonly mime: string,
    public readonly sizeBytes: number,
    public readonly storageKey: string,
    public readonly status: UploadStatus,
    public readonly createdAt: Date,
    ) {}
}

/** Byte-plane port: put/get/delete one object by storage key. Implementations own durability and
 * containment; callers never construct storage keys from user input (UploadService mints them from
 * the upload id). */
export abstract class UploadStoragePort {
    /** Writes the object, overwriting any prior bytes under the same key. */
    abstract put(storageKey: string, content: Buffer): Promise<void>;
    /** Reads the object back, or null when the key holds nothing. */
    abstract get(storageKey: string): Promise<Buffer | null>;
    /** Removes the object; a missing key is a no-op, not a failure. */
    abstract delete(storageKey: string): Promise<void>;
}

/** Content-inspection port: called once per stored object, after put and before the row flips to
 * ready. Returning means acceptable; throwing UploadScanRejectedException means rejected (the service
 * then deletes the stored object itself). Any other throw is an infrastructure failure and propagates
 * unchanged - the upload stays pending and a retry is legal. */
export abstract class VirusScanPort {
    abstract scan(storageKey: string, content: Buffer): Promise<void>;
}
