import { TestWorldErrorCode, worldError } from "../errors"
import type { FetchLike } from "./health"
import type { ProxyToxics } from "./contracts"

/** One proxy as toxiproxy lists it. */
export interface ProxyInfo {
    readonly name: string
    readonly listen: string
    readonly upstream: string
    readonly enabled: boolean
}

/** What creates a proxy. */
export interface CreateProxyRequest {
    readonly name: string
    /** The listen port inside the toxiproxy container (published on the same host port). */
    readonly listenPort: number
    /** `<container>:<port>` on the stack network. */
    readonly upstream: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

/** A client of the toxiproxy REST API (`fetch`); it only ever touches the named proxy, never the global `/reset`, so runs stay isolated. */
export class ToxiproxyClient {
    constructor(
        readonly apiUrl: string,
        private readonly fetchImpl: FetchLike = fetch,
    ) {}

    private async call(method: string, path: string, body?: unknown): Promise<{ readonly status: number; readonly json: unknown }> {
        const response = await this.fetchImpl(`${this.apiUrl}${path}`, {
            method,
            headers: body === undefined ? undefined : { "content-type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(10_000),
        })
        const text = await response.text()
        let json: unknown = null
        if (text.length > 0) {
            try {
                json = JSON.parse(text)
            } catch {
                json = text
            }
        }
        return { status: response.status, json }
    }

    private expect(what: string, result: { readonly status: number; readonly json: unknown }, allowed: ReadonlyArray<number>): void {
        if (!allowed.includes(result.status)) {
            throw worldError(TestWorldErrorCode.InfrastructureFailed, `toxiproxy ${what} answered ${result.status}: ${JSON.stringify(result.json)}`)
        }
    }

    /** The version string; the readiness probe. */
    async version(): Promise<string> {
        const result = await this.call("GET", "/version")
        this.expect("version", result, [200])
        return typeof result.json === "string" ? result.json : JSON.stringify(result.json)
    }

    /** Every proxy. */
    async listProxies(): Promise<ReadonlyArray<ProxyInfo>> {
        const result = await this.call("GET", "/proxies")
        this.expect("list proxies", result, [200])
        if (!isRecord(result.json)) return []
        return Object.values(result.json).filter(isRecord).map((proxy) => ({
            name: String(proxy.name),
            listen: String(proxy.listen),
            upstream: String(proxy.upstream),
            enabled: proxy.enabled !== false,
        }))
    }

    /** Creates a proxy (replacing one of the same name, and any stale proxy squatting on the listen port). */
    async createProxy(request: CreateProxyRequest): Promise<void> {
        const listen = `0.0.0.0:${request.listenPort}`
        for (const stale of await this.listProxies()) {
            if (stale.listen.endsWith(`:${request.listenPort}`) && stale.name !== request.name) await this.deleteProxy(stale.name)
        }
        const body = { name: request.name, listen, upstream: request.upstream, enabled: true }
        const created = await this.call("POST", "/proxies", body)
        if (created.status === 409) {
            await this.deleteProxy(request.name)
            this.expect("create proxy", await this.call("POST", "/proxies", body), [201])
            return
        }
        this.expect("create proxy", created, [201])
    }

    /** Deletes a proxy; absent is fine. */
    async deleteProxy(name: string): Promise<void> {
        this.expect("delete proxy", await this.call("DELETE", `/proxies/${encodeURIComponent(name)}`), [204, 404])
    }

    /** Adds one toxic. */
    async addToxic(proxy: string, toxic: { readonly name: string; readonly type: string; readonly stream: "upstream" | "downstream"; readonly attributes: Readonly<Record<string, number>> }): Promise<void> {
        const body = { name: toxic.name, type: toxic.type, stream: toxic.stream, toxicity: 1, attributes: toxic.attributes }
        const result = await this.call("POST", `/proxies/${encodeURIComponent(proxy)}/toxics`, body)
        if (result.status === 409) {
            this.expect("update toxic", await this.call("POST", `/proxies/${encodeURIComponent(proxy)}/toxics/${encodeURIComponent(toxic.name)}`, body), [200])
            return
        }
        this.expect("add toxic", result, [200])
    }

    /** Adds latency (with jitter) to both directions. */
    async addLatency(proxy: string, latencyMs: number, jitterMs = 0): Promise<void> {
        await this.addToxic(proxy, { name: "latency_downstream", type: "latency", stream: "downstream", attributes: { latency: latencyMs, jitter: jitterMs } })
        await this.addToxic(proxy, { name: "latency_upstream", type: "latency", stream: "upstream", attributes: { latency: latencyMs, jitter: jitterMs } })
    }

    /** Disables (`enabled: false`: stops the listener and closes live links) or enables the proxy. */
    async setEnabled(proxy: string, enabled: boolean): Promise<void> {
        this.expect("set enabled", await this.call("POST", `/proxies/${encodeURIComponent(proxy)}`, { enabled }), [200])
    }

    /** Removes every toxic of this proxy only. */
    async resetToxics(proxy: string): Promise<void> {
        const listed = await this.call("GET", `/proxies/${encodeURIComponent(proxy)}/toxics`)
        this.expect("list toxics", listed, [200])
        if (!Array.isArray(listed.json)) return
        for (const toxic of listed.json) {
            if (isRecord(toxic) && typeof toxic.name === "string") {
                this.expect("delete toxic", await this.call("DELETE", `/proxies/${encodeURIComponent(proxy)}/toxics/${encodeURIComponent(toxic.name)}`), [204, 404])
            }
        }
    }
}

/**
 * The {@link ProxyToxics} of one proxy. `cut` first arms a `reset_peer` toxic on both directions (a live connection gets a TCP
 * RST on its next byte) and then disables the proxy, which in toxiproxy 2.9 stops the listener and closes every live link, so
 * new connections are refused and old ones die. `restore` removes every toxic of this proxy and enables it again.
 */
export const proxyToxics = (client: ToxiproxyClient, proxyName: string): ProxyToxics => ({
    latency: (ms, jitterMs = 0) => client.addLatency(proxyName, ms, jitterMs),
    cut: async () => {
        await client.addToxic(proxyName, { name: "cut_downstream", type: "reset_peer", stream: "downstream", attributes: { timeout: 0 } })
        await client.addToxic(proxyName, { name: "cut_upstream", type: "reset_peer", stream: "upstream", attributes: { timeout: 0 } })
        await client.setEnabled(proxyName, false)
    },
    restore: async () => {
        await client.resetToxics(proxyName)
        await client.setEnabled(proxyName, true)
    },
})

/** The worker-side handle: {@link ProxyToxics} from the toxiproxy API url and a proxy name alone (both are in the state file). */
export const createProxyToxics = (apiUrl: string, proxyName: string): ProxyToxics => proxyToxics(new ToxiproxyClient(apiUrl), proxyName)
