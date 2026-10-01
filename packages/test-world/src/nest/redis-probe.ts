import { createConnection } from "node:net"
import { TestWorldErrorCode, worldError } from "../errors"

const encode = (args: ReadonlyArray<string>): string => `*${args.length}\r\n${args.map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join("")}`

/** Sends `commands` in order on one connection to Redis and answers the first line of each reply (`+OK`, `:42`, ...). Enough for `SELECT` and `DBSIZE`. */
export const redisReplies = (port: number, commands: ReadonlyArray<ReadonlyArray<string>>): Promise<ReadonlyArray<string>> =>
    new Promise((resolve, reject) => {
        const socket = createConnection({ host: "127.0.0.1", port })
        const replies: Array<string> = []
        let buffer = ""
        const timer = setTimeout(() => {
            socket.destroy()
            reject(worldError(TestWorldErrorCode.InfrastructureFailed, `redis on ${port} did not answer in time`))
        }, 10_000)
        socket.setEncoding("utf8")
        socket.on("connect", () => socket.write(commands.map(encode).join("")))
        socket.on("data", (chunk: string) => {
            buffer += chunk
            const lines = buffer.split("\r\n")
            buffer = lines.pop() ?? ""
            replies.push(...lines)
            if (replies.length >= commands.length) {
                clearTimeout(timer)
                socket.end()
                resolve(replies.slice(0, commands.length))
            }
        })
        socket.on("error", (cause) => {
            clearTimeout(timer)
            reject(worldError(TestWorldErrorCode.InfrastructureFailed, `redis on ${port}: ${String(cause)}`, cause))
        })
    })

/** The number of keys in the repository's Redis DB (its own index, so only its own keys). */
export const redisSize = async (directPort: number, db: number): Promise<number> => {
    const replies = await redisReplies(directPort, [["SELECT", String(db)], ["DBSIZE"]])
    return Number((replies[1] ?? ":0").slice(1))
}
