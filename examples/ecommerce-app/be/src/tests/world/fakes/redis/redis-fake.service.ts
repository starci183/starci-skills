import { createServer } from "node:net"
import type { AddressInfo, Server, Socket } from "node:net"

/** The reply of one command: a RESP line ready to write. */
const OK = "+OK\r\n"
const NIL = "$-1\r\n"

/**
 * The world's network fake of the Redis provider: a small RESP server on a loopback port, so the cache integration's own
 * client (ioredis) connects, reads and writes over a real socket. It answers the commands the integration uses (GET, SET
 * with EX, DEL, PING, INFO, SELECT, CLIENT, QUIT); entries never expire, and `failNext` makes the next data command fail
 * the way a broken store does.
 */
export class RedisFakeService {
    /** The `redis://` URL the integration is configured with. */
    url = ""

    private port = 0

    private readonly entries = new Map<string, string>()
    private readonly sockets = new Set<Socket>()
    private readonly server: Server = createServer((socket) => {
        this.sockets.add(socket)
        socket.once("close", () => this.sockets.delete(socket))
        this.serve(socket)
    })
    private failures = 0

    /** Starts the fake on a free loopback port. */
    static async start(): Promise<RedisFakeService> {
        const fake = new RedisFakeService()
        await new Promise<void>((resolve) => fake.server.listen(0, "127.0.0.1", resolve))
        const address: AddressInfo | string | null = fake.server.address()
        fake.port = typeof address === "object" && address !== null ? address.port : 0
        fake.url = `redis://127.0.0.1:${fake.port}/0`
        return fake
    }

    /** Makes the next data command answer an error, as a store that lost its disk would. */
    failNext(): void {
        this.failures += 1
    }

    /** How many entries the store holds. */
    size(): number {
        return this.entries.size
    }

    /** The keys the store holds. */
    keys(): Array<string> {
        return [...this.entries.keys()]
    }

    /**
     * Takes the provider down: the listener closes and every connection drops, `during` runs while it is down, then the same
     * port listens again with the entries it held: the outage a deployment sees when its Redis host crashes and comes back.
     */
    async interrupt(during: () => Promise<void>): Promise<void> {
        await this.stop()
        try {
            await during()
        } finally {
            await new Promise<void>((resolve) => this.server.listen(this.port, "127.0.0.1", resolve))
        }
    }

    /** Stops listening and drops every connection. */
    async stop(): Promise<void> {
        await new Promise<void>((resolve) => {
            this.server.close(() => resolve())
            for (const socket of this.sockets) socket.destroy()
        })
    }

    private serve(socket: Socket): void {
        let pending = Buffer.alloc(0)
        socket.on("error", () => socket.destroy())
        socket.on("data", (chunk: Buffer) => {
            pending = Buffer.concat([pending, chunk])
            for (;;) {
                const parsed = this.parse(pending)
                if (parsed === null) return
                pending = pending.subarray(parsed.used)
                socket.write(this.answer(parsed.args))
                if (parsed.args[0]?.toUpperCase() === "QUIT") socket.end()
            }
        })
    }

    /** One RESP array of bulk strings off the front of `buffer`, or null while it is incomplete. */
    private parse(buffer: Buffer): { args: Array<string>; used: number } | null {
        const text = buffer.toString("latin1")
        if (!text.startsWith("*")) return null
        const head = text.indexOf("\r\n")
        if (head < 0) return null
        const count = Number(text.slice(1, head))
        const args: Array<string> = []
        let cursor = head + 2
        for (let index = 0; index < count; index += 1) {
            const lengthEnd = text.indexOf("\r\n", cursor)
            if (lengthEnd < 0) return null
            const length = Number(text.slice(cursor + 1, lengthEnd))
            const start = lengthEnd + 2
            if (text.length < start + length + 2) return null
            args.push(buffer.subarray(start, start + length).toString("utf8"))
            cursor = start + length + 2
        }
        return { args, used: cursor }
    }

    private answer(args: ReadonlyArray<string>): string {
        const [name = "", key = "", value = ""] = args
        switch (name.toUpperCase()) {
            case "PING":
                return "+PONG\r\n"
            case "INFO":
                return this.bulk("redis_version:7.0.0\r\nloading:0\r\n")
            case "GET":
            case "SET":
            case "DEL":
                return this.failures > 0 ? this.fail() : this.data(name.toUpperCase(), key, value)
            default:
                return OK
        }
    }

    private data(name: string, key: string, value: string): string {
        if (name === "GET") {
            const stored = this.entries.get(key)
            return stored === undefined ? NIL : this.bulk(stored)
        }
        if (name === "SET") {
            this.entries.set(key, value)
            return OK
        }
        return `:${this.entries.delete(key) ? 1 : 0}\r\n`
    }

    private fail(): string {
        this.failures -= 1
        return "-ERR store unavailable\r\n"
    }

    private bulk(text: string): string {
        return `$${Buffer.byteLength(text)}\r\n${text}\r\n`
    }
}
