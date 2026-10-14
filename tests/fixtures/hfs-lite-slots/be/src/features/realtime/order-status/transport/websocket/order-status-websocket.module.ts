import { Module } from "@nestjs/common"
import type { DynamicModule, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import type { OrderStatusFrame } from "@modules/domain/order"
import type { VerifySupabaseAccessToken } from "@modules/integrations/supabase"
import { injector } from "@modules/platform/composition"
import type { Principal } from "@modules/platform/cqrs"
import { OrderStatusGateway } from "./order-status.gateway"

const ACCESS_TOKEN_VERIFIER: unique symbol = Symbol("order-status.access-token-verifier")

/** The socket.io surface used here; the adapter and the socket library remain owned by platform/realtime. */
export interface OrderStatusSocket {
    /** The adapter's connection identifier. */
    readonly id: string
    /** Whether the connection is still open. */
    readonly connected: boolean
    /** Untrusted handshake input: only its access token is read. */
    readonly handshake: { readonly auth: Readonly<Record<string, unknown>> }
    /** Server-side state: middleware replaces any previous principal with verified claims. */
    readonly data: { principal?: Principal }
    /** Sends one frame to this authenticated socket. */
    emit(event: "orderStatusChanged", frame: OrderStatusFrame): void
    /** Releases the stream when the connection ends. */
    once(event: "disconnect", listener: () => void): void
    /** Closes a refused or failed connection. */
    disconnect(close: boolean): void
}

/** A namespace from the app's socket.io adapter. No inbound application events are registered. */
export interface OrderStatusNamespace {
    /** Runs authentication before the connection event. */
    use(middleware: (client: OrderStatusSocket, next: (error?: Error) => void) => void): void
    /** Automatically opens the authenticated client's push stream. */
    on(event: "connection", listener: (client: OrderStatusSocket) => void): void
}

@Module({ providers: [OrderStatusGateway] })
/** The socket transport: verifies each connection, forwards hub frames and releases every disconnected subscription. */
export class OrderStatusWebsocketModule implements OnModuleInit, OnModuleDestroy {
    private readonly streams = new Map<string, AsyncIterator<OrderStatusFrame>>()

    constructor(
        private readonly gateway: OrderStatusGateway,
        @injector<VerifySupabaseAccessToken>(ACCESS_TOKEN_VERIFIER)
        private readonly verifyAccessToken: VerifySupabaseAccessToken,
    ) {}

    /** Compose with the same cryptographic verifier as identity; lite uses one API instance and the in-memory hub. */
    static register(verifyAccessToken: VerifySupabaseAccessToken): DynamicModule {
        return {
            module: OrderStatusWebsocketModule,
            providers: [{ provide: ACCESS_TOKEN_VERIFIER, useValue: verifyAccessToken }],
        }
    }

    /** Nest creates gateway namespaces before module initialization and starts listening afterwards. */
    onModuleInit(): void {
        this.gateway.namespace.use((client, next) => {
            void this.authenticate(client).then(() => next(), () => next(new Error("Unauthorized")))
        })
        this.gateway.namespace.on("connection", (client) => {
            void this.push(client).catch(() => client.disconnect(true))
        })
    }

    /** Releases all hub iterators when the app shuts down. */
    async onModuleDestroy(): Promise<void> {
        await Promise.all([...this.streams.keys()].map((id) => this.release(id)))
    }

    private async authenticate(client: OrderStatusSocket): Promise<void> {
        client.data.principal = undefined
        const token = client.handshake.auth.accessToken
        if (typeof token !== "string" || token.length === 0) throw new Error("Unauthorized")
        const verified = await this.verifyAccessToken(token)
        if (verified.kind !== "ok" || verified.value.role !== "authenticated" || verified.value.id.length === 0) {
            throw new Error("Unauthorized")
        }
        client.data.principal = verified.value
    }

    private async push(client: OrderStatusSocket): Promise<void> {
        const principal = client.data.principal
        if (principal === undefined) {
            client.disconnect(true)
            return
        }
        const iterator = this.gateway.frames(principal)[Symbol.asyncIterator]()
        this.streams.set(client.id, iterator)
        client.once("disconnect", () => {
            void this.release(client.id).catch(() => client.disconnect(true))
        })
        try {
            while (client.connected) {
                const frame = await iterator.next()
                if (frame.done || !client.connected) break
                client.emit("orderStatusChanged", frame.value)
            }
        } finally {
            await this.release(client.id)
        }
    }

    private async release(id: string): Promise<void> {
        const iterator = this.streams.get(id)
        this.streams.delete(id)
        await iterator?.return?.()
    }
}
