/**
 * Failure injection on REAL infrastructure. Every service of the stack is reached through a toxiproxy proxy, so a spec
 * makes a dependency slow or unreachable without touching the service: `world.infra.<service>.latency(ms)`, `.cut()` and
 * `.restore()`. One vocabulary for every service; a service is never killed, never stopped, never faked.
 */
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"
import { serviceOf } from "./stack.client"
import type { TestStack } from "./stack.client"

const CONTROL_TIMEOUT_MS = 15_000
const LATENCY_TOXIC = "latency"

/** What a spec can do to one real service. */
export interface InfraControl {
    /** Delays every answer of the service by `ms` milliseconds, so a caller with a shorter deadline gives up. */
    latency(ms: number): Promise<void>
    /** Makes the service unreachable: open connections drop and new ones are refused, until `restore`. */
    cut(): Promise<void>
    /** Removes every latency and reachability failure of the service: it behaves as if nothing happened. */
    restore(): Promise<void>
}

const failed = (detail: string): TestWorldError =>
    new TestWorldError({ code: TestWorldErrorCode.InfrastructureFailed, params: { detail } })

const send = async (
    apiUrl: string,
    method: "POST" | "DELETE",
    path: string,
    body?: unknown,
    tolerate: ReadonlyArray<number> = [],
): Promise<void> => {
    const response = await fetch(`${apiUrl}${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(CONTROL_TIMEOUT_MS),
    })
    if (!response.ok && !tolerate.includes(response.status)) {
        throw failed(`toxiproxy ${method} ${path} answered ${response.status}`)
    }
}

/** The control of the service `name` of the stack: one proxy per published port, all of them driven together. */
export const createInfraControl = (stack: TestStack, name: string): InfraControl => {
    const apiUrl = stack.toxiproxy.apiUrl
    const proxies = serviceOf(stack, name).ports.map((port) => port.proxyName)
    const each = async (act: (proxy: string) => Promise<void>): Promise<void> => {
        await Promise.all(proxies.map(act))
    }
    const removeLatency = (proxy: string): Promise<void> =>
        send(apiUrl, "DELETE", `/proxies/${proxy}/toxics/${LATENCY_TOXIC}`, undefined, [404])
    return {
        latency: (ms) =>
            each(async (proxy) => {
                await removeLatency(proxy)
                await send(apiUrl, "POST", `/proxies/${proxy}/toxics`, {
                    name: LATENCY_TOXIC,
                    type: "latency",
                    stream: "downstream",
                    toxicity: 1,
                    attributes: { latency: ms, jitter: 0 },
                })
            }),
        cut: () => each((proxy) => send(apiUrl, "POST", `/proxies/${proxy}`, { enabled: false })),
        restore: () =>
            each(async (proxy) => {
                await removeLatency(proxy)
                await send(apiUrl, "POST", `/proxies/${proxy}`, { enabled: true })
            }),
    }
}

/** Puts every proxy of the stack back to normal: every proxy enabled, no toxic left (a spec that failed midway leaves none behind). */
export const resetInfra = (stack: TestStack): Promise<void> => send(stack.toxiproxy.apiUrl, "POST", "/reset")
