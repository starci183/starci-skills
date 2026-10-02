import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { createServer } from "node:http"
import type { AddressInfo, Socket } from "node:net"
import { describe, it } from "node:test"
import { GRAPHQL_WS_PROTOCOL, openSubscription, websocketUrlOf } from "./subscription"

interface WsMessage {
    readonly type: string
    readonly id?: string
    readonly payload?: Record<string, unknown>
}

/** A server text frame (unmasked, payload under 64 KiB). */
const textFrame = (text: string): Buffer => {
    const payload = Buffer.from(text, "utf8")
    const head = payload.length < 126 ? Buffer.from([0x81, payload.length]) : Buffer.from([0x81, 126, payload.length >> 8, payload.length & 0xff])
    return Buffer.concat([head, payload])
}

/** A server close frame with a code and reason. */
const closeFrame = (code: number, reason: string): Buffer => {
    const body = Buffer.concat([Buffer.from([code >> 8, code & 0xff]), Buffer.from(reason, "utf8")])
    return Buffer.concat([Buffer.from([0x88, body.length]), body])
}

/** Decodes the masked client frames of a buffer: text payloads and whether a close came. */
const clientFrames = (buffer: Buffer): { readonly texts: ReadonlyArray<string>; readonly close: boolean } => {
    const texts: Array<string> = []
    let close = false
    let offset = 0
    while (offset + 2 <= buffer.length) {
        const opcode = (buffer[offset] ?? 0) & 0x0f
        let length = (buffer[offset + 1] ?? 0) & 0x7f
        let at = offset + 2
        if (length === 126) {
            length = buffer.readUInt16BE(at)
            at += 2
        }
        const mask = buffer.subarray(at, at + 4)
        at += 4
        const payload = Buffer.from(buffer.subarray(at, at + length).map((byte, index) => byte ^ (mask[index % 4] ?? 0)))
        if (opcode === 0x1) texts.push(payload.toString("utf8"))
        if (opcode === 0x8) close = true
        offset = at + length
    }
    return { texts, close }
}

/**
 * A graphql-ws server double at /graphql: acks a connection whose authorization is "Bearer good" (closes 4403 otherwise),
 * pushes `pushes` frames after a subscribe, and records every client message.
 */
const fakeGraphqlWs = async (pushes: ReadonlyArray<Record<string, unknown>>, options: { readonly errors?: boolean } = {}) => {
    const received: Array<WsMessage> = []
    const sockets: Array<Socket> = []
    const server = createServer()
    server.on("upgrade", (request, socket: Socket) => {
        sockets.push(socket)
        const accept = createHash("sha1").update(`${String(request.headers["sec-websocket-key"])}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64")
        socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\nSec-WebSocket-Protocol: ${String(request.headers["sec-websocket-protocol"])}\r\n\r\n`)
        socket.on("data", (chunk: Buffer) => {
            const { texts, close } = clientFrames(chunk)
            for (const text of texts) {
                const message = JSON.parse(text) as WsMessage
                received.push(message)
                if (message.type === "connection_init") {
                    if (message.payload?.["authorization"] === "Bearer good") socket.write(textFrame(JSON.stringify({ type: "connection_ack" })))
                    else socket.end(closeFrame(4403, "Forbidden"))
                }
                if (message.type === "subscribe") {
                    socket.write(textFrame(JSON.stringify({ type: "ping" })))
                    if (options.errors === true) socket.write(textFrame(JSON.stringify({ type: "error", id: message.id, payload: [{ message: "denied", extensions: { code: "FORBIDDEN" } }] })))
                    pushes.forEach((data, index) => setTimeout(() => socket.write(textFrame(JSON.stringify({ type: "next", id: message.id, payload: { data } }))), 30 * (index + 1)))
                }
            }
            if (close) socket.end(closeFrame(1000, "normal closure"))
        })
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    return {
        url: websocketUrlOf(baseUrl, "/graphql"),
        received,
        close: () => new Promise<void>((resolve) => {
            for (const socket of sockets) socket.destroy()
            server.close(() => resolve())
        }),
    }
}

describe("graphql-ws subscriptions", () => {
    it("derives the ws url of the app's GraphQL path", () => {
        assert.equal(websocketUrlOf("http://127.0.0.1:4000/", "graphql"), "ws://127.0.0.1:4000/graphql")
        assert.equal(websocketUrlOf("https://x", "/graphql"), "wss://x/graphql")
        assert.equal(GRAPHQL_WS_PROTOCOL, "graphql-transport-ws")
    })

    it("opens with the bearer as connectionParams.authorization, waits for pushed frames in order, answers pings and closes", async () => {
        const server = await fakeGraphqlWs([{ orderShipped: { id: "o1" } }, { orderShipped: { id: "o2" } }])
        try {
            const subscription = await openSubscription<{ orderShipped: { id: string } }>({ url: server.url, query: "subscription { orderShipped { id } }", variables: { a: 1 }, bearerToken: "good", label: "orderShipped" })
            assert.deepEqual(await subscription.next(2000), { orderShipped: { id: "o1" } })
            assert.deepEqual(await subscription.next(2000), { orderShipped: { id: "o2" } })
            assert.equal(subscription.frames().length, 2)
            await assert.rejects(subscription.next(100), /timed out after 100ms waiting for a frame of the subscription orderShipped; 2 frame\(s\) received/)
            await subscription.close()
            assert.equal(subscription.closed()?.code, 1000)
            await subscription.close()
            const types = server.received.map((message) => message.type)
            assert.deepEqual(types, ["connection_init", "subscribe", "pong", "complete"])
            assert.deepEqual(server.received[1]?.payload, { query: "subscription { orderShipped { id } }", variables: { a: 1 } })
        } finally {
            await server.close()
        }
    })

    it("a refused connection rejects with the close code; an error message fails next() naming the errors", async () => {
        const refusing = await fakeGraphqlWs([])
        try {
            await assert.rejects(openSubscription({ url: refusing.url, query: "subscription { a }", bearerToken: "bad", label: "a" }), /refused: the server closed the connection \(4403 Forbidden\)/)
        } finally {
            await refusing.close()
        }
        const denying = await fakeGraphqlWs([], { errors: true })
        try {
            const subscription = await openSubscription({ url: denying.url, query: "subscription { a }", bearerToken: "good", label: "a" })
            await assert.rejects(subscription.next(2000), /answered errors: .*FORBIDDEN/)
            assert.equal(subscription.frames().length, 0)
            await subscription.close()
        } finally {
            await denying.close()
        }
    })
})
