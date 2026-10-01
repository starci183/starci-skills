/** One receipt document to store: its object key and its exact bytes. */
export interface StoreReceiptParams {
    /** The object key, `receipts/<order id>.json`. */
    readonly key: string
    /** The JSON document. */
    readonly content: Buffer
}

/** A time-limited link that downloads one stored receipt. */
export interface ReceiptLink {
    /** The presigned GET URL. */
    readonly url: string
    /** When the link stops working. */
    readonly expiresAt: Date
}

/** What signs one S3 request with AWS Signature Version 4 in its headers. */
export interface S3SignatureParams {
    /** The HTTP method. */
    readonly method: "GET" | "PUT"
    /** The absolute path-style URL (`<endpoint>/<bucket>/<key>`), with no query string. */
    readonly url: string
    /** The exact bytes of the body (empty for a read). */
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

/** What presigns one S3 GET in its query string. */
export interface S3PresignParams {
    /** The absolute path-style URL of the object. */
    readonly url: string
    /** The instant the link is signed at. */
    readonly at: Date
    /** How long the link stays valid, in seconds. */
    readonly expiresInSeconds: number
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
