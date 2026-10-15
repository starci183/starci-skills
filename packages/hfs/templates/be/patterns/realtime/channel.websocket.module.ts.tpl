import { Module } from "@nestjs/common"
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import type { @@Channel@@Frame } from "@@serviceModule@@"
import type { VerifySupabaseAccessToken } from "@modules/integrations/supabase"
import { injector } from "@modules/platform/composition"
import type { Principal } from "@modules/platform/cqrs"
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } from "./@@channel@@-websocket.module-definition"
import type { @@Channel@@WebsocketOptions } from "./@@channel@@-websocket.options"
import { @@Channel@@Gateway } from "./@@channel@@.gateway"

const ACCESS_TOKEN_VERIFIER: unique symbol = Symbol("@@channel@@.access-token-verifier")

/** The socket.io surface used here; the adapter and the socket library remain owned by platform/realtime. */
export interface @@Channel@@Socket {
    /** The adapter's connection identifier. */
    readonly id: string
    /** Whether the connection is still open. */
    readonly connected: boolean
    /** Untrusted handshake input: only its access token is read. */
    readonly handshake: { readonly auth: Readonly<Record<string, unknown>> }
    /** Server-side state: middleware replaces any previous principal with verified claims. */
    readonly data: { principal?: Principal }
    /** Sends one frame to this authenticated socket. */
    emit(event: "@@channelCamel@@Changed", frame: @@Channel@@Frame): void
    /** Releases the stream when the connection ends. */
    once(event: "disconnect", listener: () => void): void
    /** Closes a refused or failed connection. */
    disconnect(close: boolean): void
}

/** A namespace from the app's socket.io adapter. No inbound application events are registered. */
export interface @@Channel@@Namespace {
    /** Runs authentication before the connection event. */
    use(middleware: (client: @@Channel@@Socket, next: (error?: Error) => void) => void): void
    /** Automatically opens the authenticated client's push stream. */
    on(event: "connection", listener: (client: @@Channel@@Socket) => void): void
}

@Module({
    providers: [
        @@Channel@@Gateway,
        { provide: ACCESS_TOKEN_VERIFIER, useFactory: (options: @@Channel@@WebsocketOptions) => options.verifyAccessToken, inject: [MODULE_OPTIONS_TOKEN] },
    ],
})
/** The socket transport: verifies each connection, forwards hub frames and releases every disconnected subscription. */
export class @@Channel@@WebsocketModule extends ConfigurableModuleClass implements OnModuleInit, OnModuleDestroy {
    private readonly streams = new Map<string, AsyncIterator<@@Channel@@Frame>>()

    constructor(
        private readonly gateway: @@Channel@@Gateway,
        @injector<VerifySupabaseAccessToken>(ACCESS_TOKEN_VERIFIER)
        private readonly verifyAccessToken: VerifySupabaseAccessToken,
    ) {
        super()
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

    private async authenticate(client: @@Channel@@Socket): Promise<void> {
        client.data.principal = undefined
        const token = client.handshake.auth.accessToken
        if (typeof token !== "string" || token.length === 0) throw new Error("Unauthorized")
        const verified = await this.verifyAccessToken(token)
        if (verified.kind !== "ok" || verified.value.role !== "authenticated" || verified.value.id.length === 0) {
            throw new Error("Unauthorized")
        }
        client.data.principal = verified.value
    }

    private async push(client: @@Channel@@Socket): Promise<void> {
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
                client.emit("@@channelCamel@@Changed", frame.value)
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
