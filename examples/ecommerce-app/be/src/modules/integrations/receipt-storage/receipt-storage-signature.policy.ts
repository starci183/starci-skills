import { createHash, createHmac } from "node:crypto"
import type { S3PresignParams, S3SignatureParams, S3Stamps } from "./receipt-storage.contracts"

const ALGORITHM = "AWS4-HMAC-SHA256"
const SERVICE = "s3"
const SIGNED_HEADERS = "host;x-amz-content-sha256;x-amz-date"
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD"

const sha256Hex = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex")

const hmac = (key: string | Buffer, data: string): Buffer => createHmac("sha256", key).update(data).digest()

/** `20261001T120000Z` and `20261001` of an instant, as SigV4 names them. */
const stampsOf = (at: Date): S3Stamps => {
    const amzDate = at
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "")
    return { amzDate, dateStamp: amzDate.slice(0, 8) }
}

/** The signature of `stringToSign` with the key SigV4 derives from the secret, the day and the region. */
const signatureOf = (secretAccessKey: string, dateStamp: string, region: string, stringToSign: string): string => {
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), SERVICE), "aws4_request")
    return createHmac("sha256", signingKey).update(stringToSign).digest("hex")
}

/** RFC 3986 encoding of a query value, as SigV4 canonicalises it. */
const encodeRfc3986 = (value: string): string =>
    encodeURIComponent(value).replace(
        /[!'()*]/g,
        (char) => `%${Number(char.codePointAt(0)).toString(16).toUpperCase()}`,
    )

/**
 * The AWS Signature Version 4 headers of one S3 request (path-style URL, no query string): `x-amz-date`,
 * `x-amz-content-sha256` and `authorization`, signed over the host, the payload hash and the date.
 */
export const signS3Request = (params: S3SignatureParams): Readonly<Record<string, string>> => {
    const url = new URL(params.url)
    const { amzDate, dateStamp } = stampsOf(params.at)
    const payloadHash = sha256Hex(params.payload)
    const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
    const canonicalRequest = [params.method, url.pathname, "", canonicalHeaders, SIGNED_HEADERS, payloadHash].join("\n")
    const scope = `${dateStamp}/${params.region}/${SERVICE}/aws4_request`
    const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join("\n")
    const signature = signatureOf(params.secretAccessKey, dateStamp, params.region, stringToSign)
    return {
        "x-amz-date": amzDate,
        "x-amz-content-sha256": payloadHash,
        authorization: `${ALGORITHM} Credential=${params.accessKeyId}/${scope}, SignedHeaders=${SIGNED_HEADERS}, Signature=${signature}`,
    }
}

/** A presigned GET URL of one object (SigV4 in the query string): anyone holding it reads the object until it expires. */
export const presignS3Get = (params: S3PresignParams): string => {
    const url = new URL(params.url)
    const { amzDate, dateStamp } = stampsOf(params.at)
    const scope = `${dateStamp}/${params.region}/${SERVICE}/aws4_request`
    const query: ReadonlyArray<readonly [string, string]> = [
        ["X-Amz-Algorithm", ALGORITHM],
        ["X-Amz-Credential", `${params.accessKeyId}/${scope}`],
        ["X-Amz-Date", amzDate],
        ["X-Amz-Expires", String(params.expiresInSeconds)],
        ["X-Amz-SignedHeaders", "host"],
    ]
    const canonicalQuery = query.map(([name, value]) => `${encodeRfc3986(name)}=${encodeRfc3986(value)}`).join("&")
    const canonicalRequest = ["GET", url.pathname, canonicalQuery, `host:${url.host}\n`, "host", UNSIGNED_PAYLOAD].join(
        "\n",
    )
    const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join("\n")
    const signature = signatureOf(params.secretAccessKey, dateStamp, params.region, stringToSign)
    return `${url.origin}${url.pathname}?${canonicalQuery}&X-Amz-Signature=${signature}`
}
