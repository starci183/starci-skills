import { createServer } from "node:net"

/** Reserves `count` distinct free loopback TCP ports at once (all sockets are held until every port is known, then released). */
export const freePorts = async (count: number): Promise<ReadonlyArray<number>> => {
    const servers = Array.from({ length: count }, () => createServer())
    try {
        return await Promise.all(
            servers.map(
                (server) =>
                    new Promise<number>((resolve, reject) => {
                        server.once("error", reject)
                        server.listen(0, "127.0.0.1", () => {
                            const address = server.address()
                            if (address === null || typeof address === "string") reject(new Error("no port"))
                            else resolve(address.port)
                        })
                    }),
            ),
        )
    } finally {
        await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))))
    }
}
