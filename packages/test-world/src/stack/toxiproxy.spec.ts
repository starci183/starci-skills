import assert from "node:assert/strict"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { describe, it } from "node:test"
import { ToxiproxyClient, createProxyToxics, proxyToxics } from "./toxiproxy"

interface Seen {
    readonly method: string
    readonly url: string
    readonly body: unknown
}

const withApi = async (work: (apiUrl: string, seen: Array<Seen>) => Promise<void>): Promise<void> => {
    const seen: Array<Seen> = []
    let toxics: Array<{ name: string }> = []
    const proxies: Record<string, unknown> = { stale: { name: "stale", listen: "[::]:30100", upstream: "x:1", enabled: true } }
    const server = createServer((request, response) => {
        const chunks: Array<Buffer> = []
        request.on("data", (chunk: Buffer) => chunks.push(chunk))
        request.on("end", () => {
            const text = Buffer.concat(chunks).toString()
            const body: unknown = text === "" ? undefined : JSON.parse(text)
            const method = request.method ?? ""
            const url = request.url ?? ""
            seen.push({ method, url, body })
            response.setHeader("content-type", "application/json")
            if (method === "GET" && url === "/proxies") {
                response.end(JSON.stringify(proxies))
            } else if (method === "GET" && url.endsWith("/toxics")) {
                response.end(JSON.stringify(toxics))
            } else if (method === "POST" && url.endsWith("/toxics")) {
                toxics = [...toxics, { name: (body as { name: string }).name }]
                response.end("{}")
            } else if (method === "POST" && url === "/proxies") {
                response.statusCode = 201
                response.end("{}")
            } else if (method === "DELETE") {
                response.statusCode = 204
                response.end()
            } else {
                response.end("{}")
            }
        })
    })
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done))
    try {
        await work(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, seen)
    } finally {
        server.close()
    }
}

const shape = (seen: ReadonlyArray<Seen>): Array<string> => seen.map((call) => `${call.method} ${call.url}`)

describe("toxiproxy", () => {
    it("creates a proxy on the leased port, evicting a stale proxy that squats on it", async () => {
        await withApi(async (apiUrl, seen) => {
            await new ToxiproxyClient(apiUrl).createProxy({ name: "run1-redis", listenPort: 30100, upstream: "starci-ts-redis-1:6379" })
            assert.deepEqual(shape(seen), ["GET /proxies", "DELETE /proxies/stale", "POST /proxies"])
            assert.deepEqual(seen[2]?.body, { name: "run1-redis", listen: "0.0.0.0:30100", upstream: "starci-ts-redis-1:6379", enabled: true })
        })
    })

    it("adds latency in both directions", async () => {
        await withApi(async (apiUrl, seen) => {
            await createProxyToxics(apiUrl, "p").latency(250, 40)
            const bodies = seen.filter((call) => call.method === "POST").map((call) => call.body)
            assert.deepEqual(bodies, [
                { name: "latency_downstream", type: "latency", stream: "downstream", toxicity: 1, attributes: { latency: 250, jitter: 40 } },
                { name: "latency_upstream", type: "latency", stream: "upstream", toxicity: 1, attributes: { latency: 250, jitter: 40 } },
            ])
        })
    })

    it("cut arms reset_peer both ways then disables; restore removes only this proxy's toxics and enables", async () => {
        await withApi(async (apiUrl, seen) => {
            const toxics = proxyToxics(new ToxiproxyClient(apiUrl), "run1-postgresql")
            await toxics.cut()
            assert.deepEqual(shape(seen), ["POST /proxies/run1-postgresql/toxics", "POST /proxies/run1-postgresql/toxics", "POST /proxies/run1-postgresql"])
            assert.deepEqual(seen[2]?.body, { enabled: false })
            seen.length = 0
            await toxics.restore()
            assert.deepEqual(shape(seen), [
                "GET /proxies/run1-postgresql/toxics",
                "DELETE /proxies/run1-postgresql/toxics/cut_downstream",
                "DELETE /proxies/run1-postgresql/toxics/cut_upstream",
                "POST /proxies/run1-postgresql",
            ])
            assert.deepEqual(seen[3]?.body, { enabled: true })
        })
    })

    it("fails with the status when toxiproxy refuses", async () => {
        const server = createServer((_request, response) => {
            response.statusCode = 500
            response.end("no")
        })
        await new Promise<void>((done) => server.listen(0, "127.0.0.1", done))
        try {
            await assert.rejects(new ToxiproxyClient(`http://127.0.0.1:${(server.address() as AddressInfo).port}`).version(), /answered 500/)
        } finally {
            server.close()
        }
    })
})
