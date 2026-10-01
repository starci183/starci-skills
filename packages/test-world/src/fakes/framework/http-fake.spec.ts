import assert from "node:assert/strict"
import { createServer } from "node:http"
import { test } from "node:test"
import { createFakeBridge, createFakeHandles } from "./bridge"
import type { FakeClient, FakeStartContext } from "./contracts"
import { FakesHost } from "./host"
import { defineHttpFake } from "./http-fake"

const start: FakeStartContext = { runId: "run", secret: (label) => `secret-${label}`, now: () => new Date() }

interface EchoState {
    fired: number
}

interface EchoClient extends FakeClient {
    ping(): Promise<string>
}

const echoFake = defineHttpFake<EchoClient, undefined, EchoState>({
    state: () => ({ fired: 0 }),
    values: (context) => ({ key: context.secret("echo") }),
    routes: [
        { method: "POST", path: "/echo/:id", handle: (request) => ({ status: 201, body: { id: request.params["id"], got: request.json() } }) },
        { method: "GET", path: "/stream", handle: () => ({ stream: ["data: 1\n\n", "data: 2\n\n", "data: 3\n\n"] }) },
    ],
    controlActions: {
        later: (body, context) => {
            context.schedule((body as { ms: number }).ms, () => {
                context.state.fired += 1
            })
            return { scheduled: true }
        },
        fired: (_body, context) => context.state.fired,
        hook: (body, context) =>
            context.deliverWebhook({ url: (body as { url: string }).url, body: '{"ok":true}', headers: { "x-sig": "abc" }, reference: "r1" }),
    },
    client: (bridge, base) => ({ ...base, ping: () => bridge.call<string>("ping") }),
})

const readAll = async (response: Response): Promise<string> => {
    const reader = response.body?.getReader()
    assert.ok(reader)
    let text = ""
    for (;;) {
        const { done, value } = await reader.read()
        if (done) return text
        text += Buffer.from(value).toString("utf8")
    }
}

test("records requests with raw body and answered status", async () => {
    const fake = await echoFake().start(start)
    try {
        const response = await fetch(`${fake.url}/echo/42`, {
            method: "POST",
            body: '{"a": 1}',
            headers: { "content-type": "application/json", "x-one": "1" },
        })
        assert.equal(response.status, 201)
        assert.deepEqual(await response.json(), { id: "42", got: { a: 1 } })
        await fetch(`${fake.url}/nope`)
        const log = (await fake.control("requests", undefined)) as Array<{
            method: string
            path: string
            body: string
            status: number
            headers: Record<string, string>
        }>
        assert.equal(log.length, 2)
        assert.equal(log[0]?.body, '{"a": 1}')
        assert.equal(log[0]?.status, 201)
        assert.equal(log[0]?.headers["x-one"], "1")
        assert.equal(log[1]?.status, 404)
        assert.deepEqual(fake.values, { key: "secret-echo" })
    } finally {
        await fake.close()
    }
})

test("failNext: status, times and match", async () => {
    const fake = await echoFake().start(start)
    try {
        await fake.control("fail-next", { status: 503, times: 2, match: { method: "POST", pathStartsWith: "/echo" } })
        assert.equal((await fetch(`${fake.url}/stream`)).status, 200)
        assert.equal((await fetch(`${fake.url}/echo/1`, { method: "POST", body: "{}" })).status, 503)
        assert.equal((await fetch(`${fake.url}/echo/1`, { method: "POST", body: "{}" })).status, 503)
        assert.equal((await fetch(`${fake.url}/echo/1`, { method: "POST", body: "{}" })).status, 201)
        await fake.control("fail-next", { status: 429, body: { custom: true } })
        const failed = await fetch(`${fake.url}/stream`)
        assert.equal(failed.status, 429)
        assert.deepEqual(await failed.json(), { custom: true })
    } finally {
        await fake.close()
    }
})

test("failNext timeout holds the socket until the client gives up and close does not hang", async () => {
    const fake = await echoFake().start(start)
    await fake.control("fail-next", { timeout: true })
    await assert.rejects(fetch(`${fake.url}/stream`, { signal: AbortSignal.timeout(200) }))
    const log = (await fake.control("requests", undefined)) as Array<{ status: number }>
    assert.equal(log[0]?.status, 0)
    await fake.close()
})

test("truncated stream: the client sees a premature close", async () => {
    const fake = await echoFake().start(start)
    try {
        await fake.control("fail-next", { truncateStream: { afterEvents: 2 } })
        const response = await fetch(`${fake.url}/stream`)
        const reader = response.body?.getReader()
        assert.ok(reader)
        let received = ""
        await assert.rejects(async () => {
            for (;;) {
                const { done, value } = await reader.read()
                if (done) return
                received += Buffer.from(value).toString("utf8")
            }
        })
        assert.equal(received, "data: 1\n\ndata: 2\n\n")
        assert.equal(await readAll(await fetch(`${fake.url}/stream`)), "data: 1\n\ndata: 2\n\ndata: 3\n\n")
    } finally {
        await fake.close()
    }
})

test("truncateStream afterBytes cuts inside an event", async () => {
    const fake = await echoFake().start(start)
    try {
        await fake.control("fail-next", { truncateStream: { afterBytes: 10 } })
        const response = await fetch(`${fake.url}/stream`)
        const reader = response.body?.getReader()
        assert.ok(reader)
        let received = ""
        await assert.rejects(async () => {
            for (;;) {
                const { done, value } = await reader.read()
                if (done) return
                received += Buffer.from(value).toString("utf8")
            }
        })
        assert.equal(received, "data: 1\n\nd")
    } finally {
        await fake.close()
    }
})

test("reset clears recordings, failures, state and pending timers", async () => {
    const fake = await echoFake().start(start)
    try {
        await fake.control("later", { ms: 60 })
        await fake.control("fail-next", { status: 500 })
        await fake.reset()
        await new Promise((resolve) => setTimeout(resolve, 150))
        assert.equal(await fake.control("fired", undefined), 0)
        assert.equal((await fetch(`${fake.url}/stream`)).status, 200)
        assert.equal(((await fake.control("requests", undefined)) as Array<unknown>).length, 1)
        await fake.control("later", { ms: 20 })
        await new Promise((resolve) => setTimeout(resolve, 120))
        assert.equal(await fake.control("fired", undefined), 1)
    } finally {
        await fake.close()
    }
})

test("deliverWebhook returns the app answer and reports an unreachable app as status 0", async () => {
    const fake = await echoFake().start(start)
    const app = createServer((request, response) => {
        response.writeHead(202, { "content-type": "text/plain" })
        response.end(`got ${request.headers["x-sig"] ?? ""}`)
    })
    await new Promise<void>((resolve) => app.listen(0, "127.0.0.1", resolve))
    const address = app.address()
    const port = typeof address === "object" && address !== null ? address.port : 0
    try {
        const delivery = (await fake.control("hook", { url: `http://127.0.0.1:${port}/hook` })) as {
            status: number
            response: string
            reference: string
        }
        assert.equal(delivery.status, 202)
        assert.equal(delivery.response, "got abc")
        assert.equal(delivery.reference, "r1")
        const down = (await fake.control("hook", { url: "http://127.0.0.1:1/hook" })) as { status: number }
        assert.equal(down.status, 0)
    } finally {
        app.closeAllConnections()
        await new Promise((resolve) => app.close(resolve))
        await fake.close()
    }
})

test("control channel round trip through FakesHost and the bridge", async () => {
    const definitions = { echo: echoFake() }
    const host = new FakesHost(definitions, start)
    const started = await host.start()
    try {
        const echo = started.fakes["echo"]
        assert.ok(echo)
        assert.match(echo.url, /^http:\/\/127\.0\.0\.1:\d+$/)
        const handles = createFakeHandles(definitions, started.controlUrl, () => "http://app")
        const client = handles["echo"]
        assert.ok(client)
        await client.failNext({ status: 502 })
        assert.equal((await fetch(`${echo.url}/stream`)).status, 502)
        assert.equal((await client.requests()).length, 1)
        await fetch(`${started.controlUrl}/reset`, { method: "POST" })
        assert.equal((await client.requests()).length, 0)
        const bridge = createFakeBridge(started.controlUrl, "echo", () => "http://app")
        await assert.rejects(
            bridge.call("unknown-action", {}),
            (error: Error) => /echo/.test(error.message) && /unknown-action/.test(error.message) && /404/.test(error.message),
        )
        const missing = createFakeBridge(started.controlUrl, "ghost", () => "")
        await assert.rejects(missing.call("requests"), /ghost/)
        const shutdown = host.shutdownRequested()
        await fetch(`${started.controlUrl}/shutdown`, { method: "POST" })
        await shutdown
    } finally {
        await host.close()
    }
    await assert.rejects(fetch(`${started.controlUrl}/reset`, { method: "POST" }))
})
