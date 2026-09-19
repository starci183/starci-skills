import {
    Injectable 
} from "@nestjs/common"
import {
    Socket 
} from "node:net"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    NotifyQueuePort 
} from "./notify-queue.contracts"
import {
    encodeCommand, tryParse 
} from "./resp"

const QUEUE_KEY = "notify:dispatch-queue"
const CONNECT_TIMEOUT_MS = 5_000
const REPLY_TIMEOUT_MS = 5_000

/** Atomically reads and removes every member of the sorted set whose score is <= ARGV[1], in one round
 * trip - without this script, a separate ZRANGEBYSCORE then ZREM could race a second worker reading the
 * same due jobs between the two calls. */
const DEQUEUE_DUE_SCRIPT = `
local due = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
if #due > 0 then
  redis.call('ZREM', KEYS[1], unpack(due))
end
return due
`

/**
 * integration.notify.queue: a plain Redis client speaking RESP directly (see resp.ts's comment for why),
 * backed by the dev stack's own Redis (component `redis`, port 6379 in application-stacks.yaml) - reused
 * as a queue backend is this record's own design choice, not new infrastructure this lane added. A job
 * is one member of a sorted set keyed by its due time (ZADD, score = epoch ms); `enqueue` on an existing
 * job id replaces its score rather than duplicating the member, which is exactly ZADD's own semantics.
 */
@Injectable()
/** Outbound client for the notify queue integration surface; transport failures surface as house exceptions, never raw HTTP noise. */
export class NotifyQueueClient extends NotifyQueuePort {
    constructor(private readonly config: AppConfigService) {
        super()
    }

    async enqueue(jobId: string, dueAtMs: number): Promise<void> {
        await this.run(["ZADD",
            QUEUE_KEY,
            String(dueAtMs),
            jobId])
    }

    async dequeueDue(nowMs: number): Promise<Array<string>> {
        const result = await this.run(["EVAL",
            DEQUEUE_DUE_SCRIPT,
            "1",
            QUEUE_KEY,
            String(nowMs)])
        return Array.isArray(result) ? (result as Array<string>) : []
    }

    private async run(args: Array<string>): Promise<unknown> {
        const { hostname, port } = new URL(this.config.getRedisUrl())
        const socket = await connect(hostname || "localhost",
            Number(port) || 6379)
        try {
            return await sendCommand(socket,
                args)
        } finally {
            socket.destroy()
        }
    }
}

function connect(host: string, port: number): Promise<Socket> {
    return new Promise((resolve, reject) => {
        const socket = new Socket()
        const timer = setTimeout(() => {
            socket.destroy()
            reject(new Error(`connection to redis ${host}:${port} timed out`))
        },
        CONNECT_TIMEOUT_MS)
        socket.once("connect",
            () => {
                clearTimeout(timer)
                resolve(socket)
            })
        socket.once("error",
            error => {
                clearTimeout(timer)
                reject(error)
            })
        socket.connect(port,
            host)
    })
}

function sendCommand(socket: Socket, args: Array<string>): Promise<unknown> {
    return new Promise((resolve, reject) => {
        let buffer = ""
        const timer = setTimeout(() => {
            socket.off("data",
                onData)
            reject(new Error("redis reply timed out"))
        },
        REPLY_TIMEOUT_MS)

        const onData = (chunk: Buffer) => {
            buffer += chunk.toString("binary")
            const result = tryParse(buffer,
                0)
            if (!result) return // incomplete reply so far; wait for more data
            clearTimeout(timer)
            socket.off("data",
                onData)
            if (result.value instanceof Error) {
                reject(result.value)
            } else {
                resolve(result.value)
            }
        }

        socket.on("data",
            onData)
        socket.once("error",
            error => {
                clearTimeout(timer)
                socket.off("data",
                    onData)
                reject(error)
            })
        socket.write(encodeCommand(args),
            "binary")
    })
}
