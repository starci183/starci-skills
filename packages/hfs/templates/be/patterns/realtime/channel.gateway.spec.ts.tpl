import { Test } from "@nestjs/testing"
import { MESSAGE_MAPPING_METADATA } from "@nestjs/websockets/constants"
import { @@service@@ } from "@@serviceModule@@"
import type { VerifySupabaseAccessToken } from "@modules/integrations/supabase"
import { SupabaseErrorCode } from "@modules/integrations/supabase"
import type { Principal } from "@modules/platform/cqrs"
import { ok, refused } from "@modules/platform/primitives"
import { REALTIME_HUB } from "@modules/platform/realtime"
import type { RealtimeHub, RealtimeTopic } from "@modules/platform/realtime"
import { @@Channel@@Gateway } from "./@@channel@@.gateway"
import { @@Channel@@WebsocketModule } from "./@@channel@@-websocket.module"
import type { @@Channel@@Namespace, @@Channel@@Socket } from "./@@channel@@-websocket.module"

const principal: Principal = { id: "p-1", role: "authenticated" }

/** A recording hub whose stream ends when the transport returns its iterator. */
const hubAnswering = (frame: unknown = undefined) => {
    const topics: Array<string> = []
    const released: Array<string> = []
    const hub: RealtimeHub = {
        publish: () => undefined,
        subscriberCount: () => 0,
        subscribe: <T extends object>(topic: RealtimeTopic<T>): AsyncIterable<T> => {
            topics.push(topic.name)
            let release: () => void = () => undefined
            const closed = new Promise<void>((resolve) => { release = resolve })
            let sent = false
            return {
                [Symbol.asyncIterator]: () => ({
                    next: async (): Promise<IteratorResult<T>> => {
                        if (!sent && topic.accepts(frame)) {
                            sent = true
                            return { done: false, value: frame }
                        }
                        await closed
                        return { done: true, value: undefined }
                    },
                    return: async (): Promise<IteratorResult<T>> => {
                        released.push(topic.name)
                        release()
                        return { done: true, value: undefined }
                    },
                }),
            }
        },
    }
    return { hub, topics, released }
}

/** The adapter calls middleware first and only then announces a connection. */
const namespaceAnswering = () => {
    let middleware: Parameters<@@Channel@@Namespace["use"]>[0] = (_client, next) => next(new Error("Uninitialized"))
    let connect: Parameters<@@Channel@@Namespace["on"]>[1] = () => undefined
    const namespace: @@Channel@@Namespace = {
        use: (listener) => { middleware = listener },
        on: (_event, listener) => { connect = listener },
    }
    const authenticate = (client: @@Channel@@Socket) => new Promise<void>((resolve, reject) => {
        middleware(client, (error) => error === undefined ? resolve() : reject(error))
    })
    return { namespace, authenticate, connect: (client: @@Channel@@Socket) => connect(client) }
}

const socketOf = (id: string, auth: Readonly<Record<string, unknown>> = { accessToken: "signed-token" }) => {
    let connected = true
    let disconnect: () => void = () => undefined
    let delivered: () => void = () => undefined
    const pushed = new Promise<void>((resolve) => { delivered = resolve })
    const data: { principal?: Principal } = {}
    const socket = {
        id,
        get connected(): boolean { return connected },
        handshake: { auth },
        data,
        emit: jest.fn(() => delivered()),
        once: (_event: "disconnect", listener: () => void) => { disconnect = listener },
        disconnect: jest.fn((_close: boolean) => { connected = false; disconnect() }),
    } satisfies @@Channel@@Socket
    return { socket, pushed }
}

const build = async (hub: RealtimeHub, verify: VerifySupabaseAccessToken) => {
    const moduleRef = await Test.createTestingModule({
        imports: [@@Channel@@WebsocketModule.register(verify)],
    })
        .useMocker((token) => token === REALTIME_HUB ? hub : undefined)
        .compile()
    const door = moduleRef.get(@@Channel@@Gateway)
    const transport = moduleRef.get(@@Channel@@WebsocketModule)
    const adapter = namespaceAnswering()
    door.namespace = adapter.namespace
    transport.onModuleInit()
    return { door, transport, adapter }
}

describe("@@Channel@@Gateway", () => {
    it("builds the topic only from the verified principal, ignoring handshake principal and topic claims", async () => {
        const { hub, topics } = hubAnswering()
        const verify: VerifySupabaseAccessToken = jest.fn().mockResolvedValue(ok(principal))
        const { transport, adapter } = await build(hub, verify)
        const { socket } = socketOf("socket-1", { accessToken: "signed-token", principal: { id: "p-2" }, topic: "foreign" })

        await adapter.authenticate(socket)
        adapter.connect(socket)

        expect(verify).toHaveBeenCalledWith("signed-token")
        expect(socket.data.principal).toEqual(principal)
        expect(topics).toEqual([@@service@@(principal.id).name])
        await transport.onModuleDestroy()
    })

    it("isolates another authenticated principal's topic", async () => {
        const { hub, topics } = hubAnswering()
        const verify: VerifySupabaseAccessToken = jest.fn().mockResolvedValue(ok({ id: "p-2", role: "authenticated" }))
        const { transport, adapter } = await build(hub, verify)
        const { socket } = socketOf("socket-2")

        await adapter.authenticate(socket)
        adapter.connect(socket)

        expect(topics).toEqual([@@service@@("p-2").name])
        expect(topics).not.toContain(@@service@@(principal.id).name)
        await transport.onModuleDestroy()
    })

    it("pushes a hub frame automatically and releases the iterator on disconnect", async () => {
        const frame = { id: "x-1" }
        const { hub, released } = hubAnswering(frame)
        const verify: VerifySupabaseAccessToken = jest.fn().mockResolvedValue(ok(principal))
        const { transport, adapter } = await build(hub, verify)
        const { socket, pushed } = socketOf("socket-1")

        await adapter.authenticate(socket)
        adapter.connect(socket)
        await pushed
        socket.disconnect(true)

        expect(socket.emit).toHaveBeenCalledWith("@@channelCamel@@Changed", frame)
        expect(released).toEqual([@@service@@(principal.id).name])
        await transport.onModuleDestroy()
    })

    it.each([{}, { accessToken: "" }, { accessToken: 42 }])("refuses a missing or malformed access token without invoking the verifier", async (auth) => {
        const { hub, topics } = hubAnswering()
        const verify: VerifySupabaseAccessToken = jest.fn()
        const { adapter } = await build(hub, verify)
        const { socket } = socketOf("socket-1", auth)
        socket.data.principal = principal

        await expect(adapter.authenticate(socket)).rejects.toThrow("Unauthorized")

        expect(verify).not.toHaveBeenCalled()
        expect(socket.data.principal).toBeUndefined()
        expect(topics).toEqual([])
    })

    it("refuses a rejected token and clears a prior principal", async () => {
        const { hub, topics } = hubAnswering()
        const verify: VerifySupabaseAccessToken = jest.fn().mockResolvedValue(refused(SupabaseErrorCode.AccessTokenInvalid))
        const { adapter } = await build(hub, verify)
        const { socket } = socketOf("socket-1")
        socket.data.principal = principal

        await expect(adapter.authenticate(socket)).rejects.toThrow("Unauthorized")

        expect(socket.data.principal).toBeUndefined()
        expect(topics).toEqual([])
    })

    it("refuses a connection that bypasses authentication without opening a hub stream", async () => {
        const { hub, topics } = hubAnswering()
        const { adapter } = await build(hub, jest.fn())
        const { socket } = socketOf("socket-1")

        adapter.connect(socket)

        expect(socket.disconnect).toHaveBeenCalledWith(true)
        expect(topics).toEqual([])
    })

    it("has no inbound application message handler", async () => {
        const { hub } = hubAnswering()
        const { door } = await build(hub, jest.fn())

        expect(Reflect.getMetadata(MESSAGE_MAPPING_METADATA, door.frames)).toBeUndefined()
        expect(Object.getOwnPropertyNames(@@Channel@@Gateway.prototype)).toEqual(["constructor", "frames"])
    })
})
