import {
    createServer, Server 
} from "node:net"

/**
 * Asks the OS for `count` distinct free loopback ports, then releases each listener
 * immediately. A stack service binds its compose services and api child processes from this
 * list, so no port number is ever fixed in source. The reservation lasts only for the call:
 * a port can be claimed by another process between probe and bind, which the readiness
 * probes then surface as a boot failure rather than a wrong-port mystery.
 */
export async function freePorts(count: number): Promise<Array<number>> {
    const servers: Array<Server> = []
    try {
        for (let i = 0; i < count; i += 1) {
            const server = createServer()
            await new Promise<void>((resolveListen, reject) => {
                server.once("error",
                    reject)
                server.listen(0,
                    "127.0.0.1",
                    resolveListen)
            })
            servers.push(server)
        }
        return servers.map((server) => {
            const address = server.address()
            return typeof address === "object" && address ? address.port : 0
        })
    } finally {
        await Promise.all(servers.map((server) => new Promise<void>((done) => server.close(() => done()))))
    }
}
