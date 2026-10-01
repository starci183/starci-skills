import { connect } from "node:net"
import { TestWorldErrorCode, worldError } from "../errors"

/** Sleeps for `ms`; injected so pollers and lock loops are unit-testable without real time. */
export type Pause = (ms: number) => Promise<void>

/** The real {@link Pause}: the only place library code sleeps with `setTimeout`. */
export const realPause: Pause = (ms) => new Promise<void>((done) => setTimeout(done, ms))

/** The `fetch` shape the layer needs; injected in tests. */
export type FetchLike = typeof fetch

/** How long and how often {@link waitUntil} polls. */
export interface WaitOptions {
    readonly timeoutMs: number
    readonly intervalMs: number
    readonly pause?: Pause
}

/**
 * Polls `check` until it answers true. A check that throws counts as false (the service is not up yet). Time is accounted
 * as the measured check time plus the intervals slept, so a scripted pause still terminates.
 */
export const waitUntil = async (label: string, check: () => Promise<boolean>, options: WaitOptions): Promise<void> => {
    const pause = options.pause ?? realPause
    let elapsed = 0
    let lastError = ""
    for (;;) {
        const started = Date.now()
        try {
            if (await check()) return
        } catch (cause) {
            lastError = cause instanceof Error ? cause.message : String(cause)
        }
        elapsed += Date.now() - started + options.intervalMs
        if (elapsed >= options.timeoutMs) {
            throw worldError(TestWorldErrorCode.TimedOut, `${label} was not ready after ${options.timeoutMs}ms${lastError === "" ? "" : ` (last error: ${lastError})`}`)
        }
        await pause(options.intervalMs)
    }
}

/** Whether a TCP connection to the port opens within `timeoutMs`. */
export const tcpOpen = (host: string, port: number, timeoutMs = 2000): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
        const socket = connect({ host, port })
        const finish = (ok: boolean): void => {
            socket.destroy()
            resolve(ok)
        }
        socket.setTimeout(timeoutMs, () => finish(false))
        socket.once("connect", () => finish(true))
        socket.once("error", () => finish(false))
    })

/** Whether an HTTP GET answers a 2xx status. */
export const httpOk = async (fetchImpl: FetchLike, url: string): Promise<boolean> => {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(5000) })
    await response.arrayBuffer()
    return response.status >= 200 && response.status < 300
}
