import { connect } from "node:net"
import { TestWorldErrorCode, worldError } from "../errors"

/** One decoded RESP reply. */
export type RespValue = string | number | null | ReadonlyArray<RespValue>

/** Sends commands to a Redis and answers one reply each; injected in tests. */
export type RedisRoundTrip = (host: string, port: number, commands: ReadonlyArray<ReadonlyArray<string>>) => Promise<ReadonlyArray<RespValue>>

class RespErrorReply extends Error {}

const encodeCommand = (args: ReadonlyArray<string>): string => `*${args.length}\r\n${args.map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join("")}`

/** Parses one value at `offset`; answers the value and the next offset, or null when the buffer is incomplete. */
export const parseResp = (buffer: Buffer, offset: number): { readonly value: RespValue; readonly next: number } | null => {
    const lineEnd = buffer.indexOf("\r\n", offset)
    if (lineEnd < 0) return null
    const kind = String.fromCodePoint(buffer[offset] ?? 0)
    const line = buffer.toString("utf8", offset + 1, lineEnd)
    const after = lineEnd + 2
    if (kind === "+") return { value: line, next: after }
    if (kind === "-") throw new RespErrorReply(line)
    if (kind === ":") return { value: Number(line), next: after }
    if (kind === "$") {
        const length = Number(line)
        if (length < 0) return { value: null, next: after }
        if (buffer.length < after + length + 2) return null
        return { value: buffer.toString("utf8", after, after + length), next: after + length + 2 }
    }
    if (kind === "*") {
        const count = Number(line)
        if (count < 0) return { value: null, next: after }
        const items: Array<RespValue> = []
        let cursor = after
        for (let index = 0; index < count; index += 1) {
            const item = parseResp(buffer, cursor)
            if (item === null) return null
            items.push(item.value)
            cursor = item.next
        }
        return { value: items, next: cursor }
    }
    throw new RespErrorReply(`unexpected RESP type ${kind}`)
}

/** The real {@link RedisRoundTrip}: one socket, all commands pipelined, one decoded reply per command; an error reply rejects. */
export const redisRoundTrip: RedisRoundTrip = (host, port, commands) =>
    new Promise<ReadonlyArray<RespValue>>((resolve, reject) => {
        const socket = connect({ host, port })
        const replies: Array<RespValue> = []
        let pending = Buffer.alloc(0)
        const fail = (cause: unknown): void => {
            socket.destroy()
            reject(worldError(TestWorldErrorCode.InfrastructureFailed, `redis ${host}:${port}: ${cause instanceof Error ? cause.message : String(cause)}`, cause))
        }
        socket.setTimeout(5000, () => fail(new Error("timed out")))
        socket.once("error", fail)
        socket.once("connect", () => socket.write(commands.map(encodeCommand).join("")))
        socket.on("data", (chunk: Buffer) => {
            pending = Buffer.concat([pending, chunk])
            try {
                for (;;) {
                    const parsed = parseResp(pending, 0)
                    if (parsed === null) return
                    replies.push(parsed.value)
                    pending = pending.subarray(parsed.next)
                    if (replies.length === commands.length) {
                        socket.destroy()
                        resolve(replies)
                        return
                    }
                }
            } catch (cause) {
                fail(cause)
            }
        })
    })
