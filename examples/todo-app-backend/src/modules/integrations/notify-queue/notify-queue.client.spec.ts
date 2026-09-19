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
import {
    tryParse 
} from "./resp"

interface FakeRedis {
  readonly url: string;
  /** Decoded RESP commands the client sent, one per connection. */
  readonly commands: Array<unknown>;
  /** Server-side sockets still open - the client must destroy its socket after every command. */
  openConnections(): number;
  close(): Promise<void>;
}

/** A loopback TCP server that waits for one complete RESP command per connection (decoded with the
 * client's own tryParse), records it, and answers with the canned reply. This exercises the real
 * socket path - connect, encode, parse, destroy - not a mocked-out transport. */
async function startFakeRedis(reply: string): Promise<FakeRedis> {
    const commands: Array<unknown> = []
    const sockets = new Set<Socket>()
    let open = 0
    const server: Server = createServer(socket => {
        sockets.add(socket)
        socket.on("close",
            () => sockets.delete(socket))
        open += 1
        socket.on("close",
            () => {
                open -= 1
            })
        let buffer = ""
        socket.on("data",
            chunk => {
                buffer += chunk.toString("binary")
                const parsed = tryParse(buffer,
                    0)
                if (!parsed) return
                commands.push(parsed.value)
                socket.write(reply,
                    "binary")
            })
    })
    await new Promise<void>(resolve => server.listen(0,
        "127.0.0.1",
        resolve))
    const { port } = server.address() as AddressInfo
    return {
        url: `redis://127.0.0.1:${port}`,
        commands,
        openConnections: () => open,
        close: () =>
            new Promise(resolve => {
                server.close(() => resolve())
                for (const socket of sockets) socket.destroy()
            }),
    }
}

async function boot(redisUrl: string): Promise<{ moduleRef: TestingModule; client: NotifyQueueClient }> {
    const moduleRef = await Test.createTestingModule({
        providers: [NotifyQueueClient,
            {
                provide: AppConfigService, useValue: {
                    getRedisUrl: () => redisUrl 
                } 
            }],
    }).compile()
    return {
        moduleRef, client: moduleRef.get(NotifyQueueClient) 
    }
}

async function untilSettledConnections(server: FakeRedis): Promise<void> {
    for (let i = 0; i < 50 && server.openConnections() > 0; i += 1) {
        await new Promise(resolve => setTimeout(resolve,
            10))
    }
}

describe("NotifyQueueClient (integration.notify.queue)",
    () => {
        it("enqueues a job as a ZADD on the dispatch sorted set, scored by its due time",
            async () => {
                const server = await startFakeRedis(":1\r\n")
                const { moduleRef, client } = await boot(server.url)
                try {
                    await expect(client.enqueue("job-1",
                        1700000000000)).resolves.toBeUndefined()
                    expect(server.commands).toEqual([["ZADD",
                        "notify:dispatch-queue",
                        "1700000000000",
                        "job-1"]])
                } finally {
                    await moduleRef.close()
                    await server.close()
                }
            })

        it("dequeues due jobs through the atomic EVAL script and returns their ids",
            async () => {
                const server = await startFakeRedis("*2\r\n$5\r\njob-1\r\n$5\r\njob-2\r\n")
                const { moduleRef, client } = await boot(server.url)
                try {
                    await expect(client.dequeueDue(1700000000000)).resolves.toEqual(["job-1",
                        "job-2"])
                    const command = server.commands[0] as Array<string>
                    expect(command[0]).toBe("EVAL")
                    expect(command[1]).toContain("ZRANGEBYSCORE")
                    expect(command.slice(2)).toEqual(["1",
                        "notify:dispatch-queue",
                        "1700000000000"])
                } finally {
                    await moduleRef.close()
                    await server.close()
                }
            })

        it("treats a non-array reply to dequeueDue as an empty batch",
            async () => {
                const server = await startFakeRedis("+OK\r\n")
                const { moduleRef, client } = await boot(server.url)
                try {
                    await expect(client.dequeueDue(1700000000000)).resolves.toEqual([])
                } finally {
                    await moduleRef.close()
                    await server.close()
                }
            })

        it("rejects when redis answers the command with an error",
            async () => {
                const server = await startFakeRedis("-ERR unknown command\r\n")
                const { moduleRef, client } = await boot(server.url)
                try {
                    await expect(client.dequeueDue(1700000000000)).rejects.toThrow("ERR unknown command")
                } finally {
                    await moduleRef.close()
                    await server.close()
                }
            })

        it("rejects when the configured redis is unreachable",
            async () => {
                // Port 1 on loopback refuses instantly - no server is stood up for this case.
                const { moduleRef, client } = await boot("redis://127.0.0.1:1")
                try {
                    await expect(client.enqueue("job-1",
                        1700000000000)).rejects.toThrow()
                } finally {
                    await moduleRef.close()
                }
            })

        it("closes the socket after each command rather than leaking connections",
            async () => {
                const server = await startFakeRedis(":1\r\n")
                const { moduleRef, client } = await boot(server.url)
                try {
                    await client.enqueue("job-1",
                        1700000000000)
                    await untilSettledConnections(server)
                    expect(server.openConnections()).toBe(0)
                } finally {
                    await moduleRef.close()
                    await server.close()
                }
            })
    })
