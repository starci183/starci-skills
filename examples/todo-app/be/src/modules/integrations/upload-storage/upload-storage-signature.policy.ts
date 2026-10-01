import { createHash, createHmac } from "node:crypto"
import type { S3SignatureParams, S3Stamps } from "./upload-storage.contracts"

const ALGORITHM = "AWS4-HMAC-SHA256"
const SERVICE = "s3"
const SIGNED_HEADERS = "host;x-amz-content-sha256;x-amz-date"

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

/**
 * The AWS Signature Version 4 headers of one S3 request (path-style URL, no query string): `x-amz-date`,
 * `x-amz-content-sha256` and `authorization`, signed over the host, the payload hash and the date. MinIO and S3 verify the
 * same signature; the host is the URL's own, which is the `Host` header the request carries.
 */
export const signS3Request = (params: S3SignatureParams): Readonly<Record<string, string>> => {
    const url = new URL(params.url)
    const { amzDate, dateStamp } = stampsOf(params.at)
    const payloadHash = sha256Hex(params.payload)
    const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
    const canonicalRequest = [params.method, url.pathname, "", canonicalHeaders, SIGNED_HEADERS, payloadHash].join("\n")
    const scope = `${dateStamp}/${params.region}/${SERVICE}/aws4_request`
    const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join("\n")
    const signingKey = hmac(
        hmac(hmac(hmac(`AWS4${params.secretAccessKey}`, dateStamp), params.region), SERVICE),
        "aws4_request",
    )
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex")
    return {
        "x-amz-date": amzDate,
        "x-amz-content-sha256": payloadHash,
        authorization: `${ALGORITHM} Credential=${params.accessKeyId}/${scope}, SignedHeaders=${SIGNED_HEADERS}, Signature=${signature}`,
    }
}
