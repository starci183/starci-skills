/** Names one object of the storage plane; the storage key is derived from the upload id only. */
export interface UploadObjectParams {
    /** The id of the upload the object belongs to. */
    readonly uploadId: string
}

/** What storing an object needs. */
export interface StoreUploadParams {
    /** The id of the upload the object belongs to. */
    readonly uploadId: string
    /** The bytes; storing over an existing object replaces it. */
    readonly content: Buffer
}

/** What inspecting an object needs. */
export interface ScanUploadParams {
    /** The id of the upload the object belongs to. */
    readonly uploadId: string
    /** The bytes that were stored. */
    readonly content: Buffer
}

/** The answer of the content inspection: accepted, or rejected with a reason. */
export type ScanVerdict = { readonly accepted: true } | { readonly accepted: false; readonly reason: string }

/** The answer of reading an object: its bytes, or null when nothing is stored for the upload. */
export type StoredBytesResult = Buffer | null

/** What signs one S3 request with AWS Signature Version 4. */
export interface S3SignatureParams {
    /** The HTTP method. */
    readonly method: "GET" | "PUT" | "DELETE"
    /** The absolute path-style URL (`<endpoint>/<bucket>/<key>`), with no query string. */
    readonly url: string
    /** The exact bytes of the body (empty for a read or a delete). */
    readonly payload: Buffer
    /** The instant the request is signed at. */
    readonly at: Date
    /** The region the bucket lives in. */
    readonly region: string
    /** The access key id. */
    readonly accessKeyId: string
    /** The secret access key, revealed only to sign. */
    readonly secretAccessKey: string
}

/** The two date forms of one SigV4 signature: the request date and its day. */
export interface S3Stamps {
    /** `20261001T120000Z`. */
    readonly amzDate: string
    /** `20261001`. */
    readonly dateStamp: string
}
