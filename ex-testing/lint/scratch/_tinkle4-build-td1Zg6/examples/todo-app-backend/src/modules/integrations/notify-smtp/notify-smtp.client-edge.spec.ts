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
    NotifySmtpClient 
} from "./notify-smtp.client"

/** Edge cases for notify-smtp.client.ts beyond the main spec's coverage: the classification boundary
 * (only RCPT TO's 5xx is permanent), refusals at the later verbs, and a silent server. */

interface SmtpScript {
  greeting?: string | null;
  ehlo?: string;
  mailFrom?: string;
  rcptTo?: string;
  data?: string;
  accepted?: string;
}

interface FakeSmtp {
  readonly port: number;
  close(): Promise<void>;
}

/** A loopback SMTP server scripted per verb; a null greeting sends nothing at all on connect. */
async function startFakeSmtp(script: SmtpScript = {
}): Promise<FakeSmtp> {
    const sockets = new Set<Socket>()
    let inData = false
    const server: Server = createServer(socket => {
        sockets.add(socket)
        socket.on("close",
            () => sockets.delete(socket))
        if (script.greeting !== null) socket.write(script.greeting ?? "220 fake ESMTP\r\n")
        let buffer = ""
        socket.on("data",
            chunk => {
                buffer += chunk.toString("utf8")
                let eol: number
                while ((eol = buffer.indexOf("\r\n")) !== -1) {
                    const line = buffer.slice(0,
                        eol)
                    buffer = buffer.slice(eol + 2)
                    if (inData) {
                        if (line === ".") {
                            inData = false
                            socket.write(script.accepted ?? "250 queued\r\n")
                        }
                        continue
                    }
                    if (line.startsWith("EHLO")) socket.write(script.ehlo ?? "250-fake greets you\r\n")
                    else if (line.startsWith("MAIL FROM")) socket.write(script.mailFrom ?? "250 OK\r\n")
                    else if (line.startsWith("RCPT TO")) socket.write(script.rcptTo ?? "250 OK\r\n")
                    else if (line === "DATA") {
                        inData = true
                        socket.write(script.data ?? "354 end with .\r\n")
                    }
                }
            })
    })
    await new Promise<void>(resolve => server.listen(0,
        "127.0.0.1",
        resolve))
    const { port } = server.address() as AddressInfo
    return {
        port,
        close: () =>
            new Promise(resolve => {
                server.close(() => resolve())
                for (const socket of sockets) socket.destroy()
            }),
    }
}

const modules: Array<TestingModule> = []

async function boot(port: number): Promise<NotifySmtpClient> {
    const moduleRef = await Test.createTestingModule({
        providers: [
            NotifySmtpClient,
            {
                provide: AppConfigService,
                useValue: {
                    getSmtpHost: () => "127.0.0.1",
                    getSmtpPort: () => port,
                    getSmtpFromAddress: () => "notify@todo.dev",
                },
            },
        ],
    }).compile()
    modules.push(moduleRef)
    return moduleRef.get(NotifySmtpClient)
}

afterEach(async () => {
    while (modules.length) await modules.pop()?.close()
})

const message = {
    to: "person@example.com", subject: "Welcome", body: "hello there" 
}
const transient = expect.objectContaining({
    code: "NOTIFY_SMTP_TRANSIENT_FAILURE_EXCEPTION" 
})

describe("NotifySmtpClient.send edge cases",
    () => {
        it("maps a 5xx at MAIL FROM to transient - only RCPT TO carries the permanent classification",
            async () => {
                // br.notify.failure.classified: RCPT TO is the sole permanent step; a 5xx anywhere else retries.
                const server = await startFakeSmtp({
                    mailFrom: "550 sender rejected\r\n" 
                })
                const client = await boot(server.port)
                try {
                    await expect(client.send(message)).rejects.toThrow(transient)
                } finally {
                    await server.close()
                }
            })

        it("maps a refusal of the DATA verb to transient",
            async () => {
                const server = await startFakeSmtp({
                    data: "503 bad sequence of commands\r\n" 
                })
                const client = await boot(server.port)
                try {
                    await expect(client.send(message)).rejects.toThrow(transient)
                } finally {
                    await server.close()
                }
            })

        it("maps a rejection after the terminating dot to transient",
            async () => {
                const server = await startFakeSmtp({
                    accepted: "550 message rejected\r\n" 
                })
                const client = await boot(server.port)
                try {
                    await expect(client.send(message)).rejects.toThrow(transient)
                } finally {
                    await server.close()
                }
            })

        it("maps a non-250, non-5xx answer at RCPT TO to transient, not permanent",
            async () => {
                const server = await startFakeSmtp({
                    rcptTo: "251 user not local; will forward\r\n" 
                })
                const client = await boot(server.port)
                try {
                    await expect(client.send(message)).rejects.toThrow(transient)
                } finally {
                    await server.close()
                }
            })

        it("maps a server that never greets to transient once the response timer fires",
            async () => {
                const server = await startFakeSmtp({
                    greeting: null 
                })
                const client = await boot(server.port)
                try {
                    await expect(client.send(message)).rejects.toThrow(transient)
                } finally {
                    await server.close()
                }
            },
            15_000)

        it("maps an unreachable host to transient whichever refusal wins the race",
            async () => {
                // Non-routable address: the OS refusal or the client's own 5s connect timer settles the call.
                const client = await boot(0)
                await expect(client.send(message)).rejects.toThrow(transient)
            })
    })
