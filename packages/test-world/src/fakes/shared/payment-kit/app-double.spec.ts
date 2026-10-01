/** Test helper of the payment fakes: a local http server standing in for the app under test, and a runner for one fake. */
import { createServer } from "node:http"
import type { FakeClient, FakeDefinition, FakeStartContext } from "../../framework/contracts"
import { createFakeHandles } from "../../framework/bridge"
import { FakesHost } from "../../framework/host"

/** One request the stand-in app received. */
export interface AppRequest {
    readonly method: string
    readonly url: string
    readonly headers: Readonly<Record<string, string>>
    readonly body: string
}

/** The stand-in app. */
export interface AppDouble {
    readonly url: string
    readonly received: Array<AppRequest>
    /** What it answers from now on. */
    answer(status: number, body: string): void
    close(): Promise<void>
}

/** Starts a stand-in app on a loopback port. */
export const startAppDouble = async (): Promise<AppDouble> => {
    const received: Array<AppRequest> = []
    let status = 200
    let answerBody = "{}"
    const server = createServer((request, response) => {
        const chunks: Array<Buffer> = []
        request.on("data", (chunk: Buffer) => chunks.push(chunk))
        request.on("end", () => {
            const headers: Record<string, string> = {}
            for (const [name, value] of Object.entries(request.headers)) if (typeof value === "string") headers[name] = value
            received.push({ method: request.method ?? "", url: request.url ?? "", headers, body: Buffer.concat(chunks).toString("utf8") })
            response.writeHead(status, { "content-type": "application/json" })
            response.end(answerBody)
        })
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()))
    const address = server.address()
    const port = typeof address === "object" && address !== null ? address.port : 0
    return {
        url: `http://127.0.0.1:${port}`,
        received,
        answer: (nextStatus, nextBody) => {
            status = nextStatus
            answerBody = nextBody
        },
        close: () =>
            new Promise<void>((resolve) => {
                server.closeAllConnections()
                server.close(() => resolve())
            }),
    }
}

/** What a runner hands the test. */
export interface RunningFake<TClient extends FakeClient> {
    readonly client: TClient
    readonly values: Readonly<Record<string, string>>
    readonly baseUrl: string
    readonly app: AppDouble
}

const START: FakeStartContext = { runId: "run", secret: (label) => `s-${label}`, now: () => new Date("2026-03-01T05:00:00Z") }

/** Starts one fake and a stand-in app, gives the client the app as webhook target, runs the test, then stops both. */
export const withPaymentFake = async <TClient extends FakeClient>(
    definition: FakeDefinition<TClient>,
    run: (running: RunningFake<TClient>) => Promise<void>,
): Promise<void> => {
    const app = await startAppDouble()
    const definitions = { pay: definition as FakeDefinition }
    const host = new FakesHost(definitions, START)
    const started = await host.start()
    try {
        const handle = createFakeHandles(definitions, started.controlUrl, () => app.url)["pay"]
        if (handle === undefined) throw new Error("no handle")
        const fake = started.fakes["pay"]
        await run({ client: handle as TClient, values: fake?.values ?? {}, baseUrl: fake?.url ?? "", app })
    } finally {
        await host.close()
        await app.close()
    }
}

/** Waits until `check` is true or the deadline passes. */
export const waitUntil = async (check: () => boolean, timeoutMs = 3000): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        if (check()) return true
        await new Promise((resolve) => setTimeout(resolve, 20))
    }
    return check()
}
