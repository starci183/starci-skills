import { createHash, createHmac } from "node:crypto"

/** What one AWS Signature Version 4 signing needs. */
export interface SigV4Request {
    readonly method: string
    /** The already URI-encoded absolute path (S3 style: encoded once). */
    readonly path: string
    readonly query: Readonly<Record<string, string>>
    /** Every header to sign, including `host` and `x-amz-date`. */
    readonly headers: Readonly<Record<string, string>>
    readonly body: string | Buffer
    readonly accessKey: string
    readonly secretKey: string
    readonly region: string
    readonly service: string
    /** The signing instant as `YYYYMMDDTHHMMSSZ`. */
    readonly amzDate: string
    /** Use this as the payload hash instead of hashing `body` (e.g. `UNSIGNED-PAYLOAD`). */
    readonly payloadHash?: string
}

/** The lowercase hex sha256 of text or bytes. */
export const sha256Hex = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex")

const hmac = (key: string | Buffer, data: string): Buffer => createHmac("sha256", key).update(data).digest()

/** RFC 3986 encoding as SigV4 wants it (everything but `A-Za-z0-9-_.~`). */
export const uriEncode = (value: string): string => encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)

/** The canonical query string: keys sorted, keys and values encoded. */
export const canonicalQuery = (query: Readonly<Record<string, string>>): string =>
    Object.entries(query)
        .map(([key, value]) => [uriEncode(key), uriEncode(value)] as const)
        .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1))
        .map(([key, value]) => `${key}=${value}`)
        .join("&")

/** The `YYYYMMDDTHHMMSSZ` form of an instant. */
export const amzDateOf = (instant: Date): string => instant.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")

/** The signed pieces of a request. */
export interface SigV4Signature {
    /** The value of the `Authorization` header. */
    readonly authorization: string
    readonly signature: string
    readonly signedHeaders: string
    readonly canonicalRequest: string
}

/** Signs a request with AWS Signature Version 4 (node:crypto only). */
export const signV4 = (request: SigV4Request): SigV4Signature => {
    const headers = Object.entries(request.headers)
        .map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/g, " ")] as const)
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    const signedHeaders = headers.map(([name]) => name).join(";")
    const payloadHash = request.payloadHash ?? sha256Hex(request.body)
    const canonicalRequest = [
        request.method.toUpperCase(),
        request.path,
        canonicalQuery(request.query),
        `${headers.map(([name, value]) => `${name}:${value}`).join("\n")}\n`,
        signedHeaders,
        payloadHash,
    ].join("\n")
    const day = request.amzDate.slice(0, 8)
    const scope = `${day}/${request.region}/${request.service}/aws4_request`
    const stringToSign = ["AWS4-HMAC-SHA256", request.amzDate, scope, sha256Hex(canonicalRequest)].join("\n")
    const key = hmac(hmac(hmac(hmac(`AWS4${request.secretKey}`, day), request.region), request.service), "aws4_request")
    const signature = createHmac("sha256", key).update(stringToSign).digest("hex")
    return {
        authorization: `AWS4-HMAC-SHA256 Credential=${request.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        signature,
        signedHeaders,
        canonicalRequest,
    }
}
