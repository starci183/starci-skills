import { TestWorldErrorCode, worldError } from "../../errors"
import type { RunMinio } from "../contracts"
import { httpOk } from "../health"
import { amzDateOf, canonicalQuery, sha256Hex, signV4, uriEncode } from "../sigv4"
import { baseUrl, randomSecret } from "./definition"
import type { ServiceDefinition, ServiceTarget } from "./definition"

const REGION = "us-east-1"

/** The credentials a signed request uses. */
export interface S3Credentials {
    readonly accessKey: string
    readonly secretKey: string
}

const encodePath = (path: string): string => path.split("/").map(uriEncode).join("/")

/** One SigV4-signed path-style S3 request against the direct port of MinIO. */
export const s3Request = async (
    target: Pick<ServiceTarget, "host" | "port" | "net">,
    credentials: S3Credentials,
    method: string,
    path: string,
    query: Readonly<Record<string, string>> = {},
    now: Date = new Date(),
): Promise<{ readonly status: number; readonly text: string }> => {
    const host = `${target.host}:${target.port}`
    const encodedPath = encodePath(path)
    const amzDate = amzDateOf(now)
    const payloadHash = sha256Hex("")
    const headers = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate }
    const { authorization } = signV4({ method, path: encodedPath, query, headers, body: "", accessKey: credentials.accessKey, secretKey: credentials.secretKey, region: REGION, service: "s3", amzDate })
    const queryString = canonicalQuery(query)
    const response = await target.net.fetch(`http://${host}${encodedPath}${queryString === "" ? "" : `?${queryString}`}`, {
        method,
        headers: { "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate, authorization },
        signal: AbortSignal.timeout(30_000),
    })
    return { status: response.status, text: await response.text() }
}

const unescapeXml = (value: string): string => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")

const tagValues = (xml: string, tag: string): Array<string> => [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map((match) => unescapeXml(match[1] ?? ""))

const expectStatus = (what: string, result: { readonly status: number; readonly text: string }, allowed: ReadonlyArray<number>): void => {
    if (!allowed.includes(result.status)) throw worldError(TestWorldErrorCode.InfrastructureFailed, `minio ${what} answered ${result.status}: ${result.text.slice(0, 300)}`)
}

const emptyBucket = async (target: ServiceTarget, credentials: S3Credentials, bucket: string): Promise<void> => {
    for (;;) {
        const listed = await s3Request(target, credentials, "GET", `/${bucket}`, { "list-type": "2", "max-keys": "500" })
        if (listed.status === 404) return
        expectStatus(`list ${bucket}`, listed, [200])
        const keys = tagValues(listed.text, "Key")
        if (keys.length === 0) return
        for (const key of keys) expectStatus(`delete ${bucket}/${key}`, await s3Request(target, credentials, "DELETE", `/${bucket}/${key}`), [200, 204, 404])
    }
}

const repoBuckets = async (target: ServiceTarget, credentials: S3Credentials, prefix: string): Promise<ReadonlyArray<string>> => {
    const listed = await s3Request(target, credentials, "GET", "/")
    expectStatus("list buckets", listed, [200])
    return tagValues(listed.text, "Name").filter((name) => name.startsWith(prefix))
}

/** MinIO: one shared server per image; a namespace owns the buckets `<namespace.kebab>-<name>`. */
export const minioService: ServiceDefinition<RunMinio> = {
    name: "minio",
    port: 9000,
    newSecrets: () => ({ accessKey: `starci${randomSecret(4)}`, secretKey: randomSecret(16) }),
    spec: (_image, secrets) => ({
        env: { MINIO_ROOT_USER: secrets.accessKey ?? "", MINIO_ROOT_PASSWORD: secrets.secretKey ?? "" },
        command: ["server", "/data"],
    }),
    ready: (target) => httpOk(target.net.fetch, `${baseUrl(target)}/minio/health/ready`),
    provision: async (target, input) => {
        const credentials = { accessKey: target.secrets.accessKey ?? "", secretKey: target.secrets.secretKey ?? "" }
        const bucketPrefix = `${input.namespace.kebab}-`
        const buckets: Record<string, string> = {}
        for (const name of input.request.minio?.buckets ?? []) {
            const stored = `${bucketPrefix}${name}`
            buckets[name] = stored
            expectStatus(`create ${stored}`, await s3Request(target, credentials, "PUT", `/${stored}`), [200, 409])
        }
        return { run: { ...credentials, bucketPrefix, buckets } }
    },
    reset: async (target, run) => {
        const credentials = { accessKey: run.accessKey, secretKey: run.secretKey }
        for (const bucket of await repoBuckets(target, credentials, run.bucketPrefix)) await emptyBucket(target, credentials, bucket)
    },
    deprovision: async (target, run) => {
        const credentials = { accessKey: run.accessKey, secretKey: run.secretKey }
        for (const bucket of await repoBuckets(target, credentials, run.bucketPrefix)) {
            await emptyBucket(target, credentials, bucket)
            expectStatus(`delete bucket ${bucket}`, await s3Request(target, credentials, "DELETE", `/${bucket}`), [200, 204, 404])
        }
    },
}
