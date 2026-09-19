import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    AddressInfo, createServer, Server, Socket 
} from "node:net"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    NotifyQueueClient 
} from "./notify-queue.client"

/** Edge cases for notify-queue.client.ts beyond the main spec's coverage: reply timeouts, replies
 * split across TCP packets, and malformed configuration - still through the real socket path. */

interface FakeRedis {
  readonly url: string;
  close(): Promise<void>;
}

type ReplyBehavior =
  | { kind: "never" }
  | { kind: "chunks"; chunks: Array<string>; delayMs: number };

/** A loopback TCP server that accepts connections and reads each command but controls how (or
 * whether) it answers - for the failure and packet-boundary paths a canned reply cannot express. */
async function startFakeRedis(behavior: ReplyBehavior): Promise<FakeRedis> {
    const sockets = new Set<Socket>()
    const server: Server = createServer(socket => {
        sockets.add(socket)
        socket.on("close",
            () => sockets.delete(socket))
        socket.on("data",
            () => {
                if (behavior.kind === "never") return
                let delay = 0
                for (const chunk of behavior.chunks) {
                    setTimeout(() => socket.write(chunk,
                        "binary"),
                    delay)
                    delay += behavior.delayMs
                }
            })
    })
    await new Promise<void>(resolve => server.listen(0,
        "127.0.0.1",
        resolve))
    const { port } = server.address() as AddressInfo
    return {
        url: `redis://127.0.0.1:${port}`,
        close: () =>
            new Promise(resolve => {
                server.close(() => resolve())
                for (const socket of sockets) socket.destroy()
            }),
    }
}

const modules: Array<TestingModule> = []

async function boot(redisUrl: string): Promise<NotifyQueueClient> {
    const moduleRef = await Test.createTestingModule({
        providers: [NotifyQueueClient,
            {
                provide: AppConfigService, useValue: {
                    getRedisUrl: () => redisUrl 
                } 
            }],
    }).compile()
    modules.push(moduleRef)
    return moduleRef.get(NotifyQueueClient)
}

afterEach(async () => {
    while (modules.length) await modules.pop()?.close()
})

describe("NotifyQueueClient edge cases",
    () => {
        it("rejects with \"redis reply timed out\" when the server answers a command with silence",
            async () => {
                const server = await startFakeRedis({
                    kind: "never" 
                })
                const client = await boot(server.url)
                try {
                    await expect(client.enqueue("job-1",
                        1700000000000)).rejects.toThrow("redis reply timed out")
                } finally {
                    await server.close()
                }
            },
            15_000)

        it("reassembles a reply split across TCP packets before resolving",
            async () => {
                // tryParse returns null on an incomplete reply: the client must keep buffering, not answer early.
                const server = await startFakeRedis({
                    kind: "chunks", chunks: ["*2\r\n$5\r\njob",
                        "-1\r\n$5\r\njob-2\r\n"], delayMs: 30 
                })
                const client = await boot(server.url)
                try {
                    await expect(client.dequeueDue(1700000000000)).resolves.toEqual(["job-1",
                        "job-2"])
                } finally {
                    await server.close()
                }
            })

        it("rejects a malformed redis url instead of failing silently",
            async () => {
                const client = await boot("not-a-url")
                await expect(client.enqueue("job-1",
                    1700000000000)).rejects.toThrow()
            })

        it("rejects rather than hanging when the host cannot be connected",
            async () => {
                // A non-routable address: whichever of the OS refusal or the client's own 5s connect timer fires
                // first, the call must settle as a rejection.
                const client = await boot("redis://10.255.255.1:6379")
                await expect(client.enqueue("job-1",
                    1700000000000)).rejects.toThrow()
            },
            15_000)
    })
