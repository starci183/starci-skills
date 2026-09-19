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

interface SmtpScript {
  /** Answer written on connect. */
  greeting?: string;
  ehlo?: string;
  mailFrom?: string;
  rcptTo?: string;
  /** Answer to the DATA verb itself. */
  data?: string;
  /** Answer after the terminating '.'. */
  accepted?: string;
  quit?: string;
}

interface FakeSmtp {
  readonly port: number;
  /** Command lines received outside DATA. */
  readonly commands: Array<string>;
  /** Payload lines received between DATA and the terminating '.'. */
  readonly dataLines: Array<string>;
  close(): Promise<void>;
}

/** A loopback SMTP submission server scripted line-by-line, so the spec exercises the client's real
 * socket dialogue (greeting, EHLO, MAIL FROM, RCPT TO, DATA, QUIT) rather than a mocked transport. */
async function startFakeSmtp(script: SmtpScript = {
}): Promise<FakeSmtp> {
    const commands: Array<string> = []
    const dataLines: Array<string> = []
    let inData = false
    const sockets = new Set<Socket>()
    const server: Server = createServer(socket => {
        sockets.add(socket)
        socket.on("close",
            () => sockets.delete(socket))
        socket.write(script.greeting ?? "220 fake ESMTP\r\n")
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
                        } else {
                            dataLines.push(line)
                        }
                        continue
                    }
                    commands.push(line)
                    if (line.startsWith("EHLO")) socket.write(script.ehlo ?? "250-fake greets you\r\n")
                    else if (line.startsWith("MAIL FROM")) socket.write(script.mailFrom ?? "250 OK\r\n")
                    else if (line.startsWith("RCPT TO")) socket.write(script.rcptTo ?? "250 OK\r\n")
                    else if (line === "DATA") {
                        inData = true
                        socket.write(script.data ?? "354 end with .\r\n")
                    } else if (line === "QUIT") socket.write(script.quit ?? "221 bye\r\n")
                }
            })
    })
    await new Promise<void>(resolve => server.listen(0,
        "127.0.0.1",
        resolve))
    const { port } = server.address() as AddressInfo
    return {
        port,
        commands,
        dataLines,
        close: () =>
            new Promise(resolve => {
                server.close(() => resolve())
                for (const socket of sockets) socket.destroy()
            }),
    }
}

async function boot(port: number): Promise<{ moduleRef: TestingModule; client: NotifySmtpClient }> {
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
    return {
        moduleRef, client: moduleRef.get(NotifySmtpClient) 
    }
}

const message = {
    to: "person@example.com", subject: "Welcome", body: "hello there" 
}

describe("NotifySmtpClient.send (integration.notify.smtp)",
    () => {
        it("speaks the full submission dialogue and delivers the rendered message",
            async () => {
                const server = await startFakeSmtp()
                const { moduleRef, client } = await boot(server.port)
                try {
                    await expect(client.send(message)).resolves.toBeUndefined()
                    expect(server.commands).toEqual([
                        "EHLO 127.0.0.1",
                        "MAIL FROM:<notify@todo.dev>",
                        "RCPT TO:<person@example.com>",
                        "DATA",
                        "QUIT",
                    ])
                    expect(server.dataLines).toEqual([
                        "From: notify@todo.dev",
                        "To: person@example.com",
                        "Subject: Welcome",
                        "",
                        "hello there",
                    ])
                } finally {
                    await moduleRef.close()
                    await server.close()
                }
            })

        it("maps an unreachable host to a transient failure",
            async () => {
                // Port 1 on loopback refuses instantly - no server is stood up for this case.
                const { moduleRef, client } = await boot(1)
                try {
                    await expect(client.send(message)).rejects.toThrow(
                        expect.objectContaining({
                            code: "NOTIFY_SMTP_TRANSIENT_FAILURE_EXCEPTION" 
                        }),
                    )
                } finally {
                    await moduleRef.close()
                }
            })

        it("maps a non-220 greeting to a transient failure",
            async () => {
                const server = await startFakeSmtp({
                    greeting: "554 no service\r\n" 
                })
                const { moduleRef, client } = await boot(server.port)
                try {
                    await expect(client.send(message)).rejects.toThrow(
                        expect.objectContaining({
                            code: "NOTIFY_SMTP_TRANSIENT_FAILURE_EXCEPTION" 
                        }),
                    )
                } finally {
                    await moduleRef.close()
                    await server.close()
                }
            })

        it("maps a refused EHLO to a transient failure",
            async () => {
                const server = await startFakeSmtp({
                    ehlo: "500 command unrecognized\r\n" 
                })
                const { moduleRef, client } = await boot(server.port)
                try {
                    await expect(client.send(message)).rejects.toThrow(
                        expect.objectContaining({
                            code: "NOTIFY_SMTP_TRANSIENT_FAILURE_EXCEPTION" 
                        }),
                    )
                } finally {
                    await moduleRef.close()
                    await server.close()
                }
            })

        it("maps a 5xx at RCPT TO to a permanent rejection of the address",
            async () => {
                // br.notify.failure.classified: RCPT TO is the one step whose 5xx is terminal for the address.
                const server = await startFakeSmtp({
                    rcptTo: "550 no such user\r\n" 
                })
                const { moduleRef, client } = await boot(server.port)
                try {
                    await expect(client.send(message)).rejects.toThrow(
                        expect.objectContaining({
                            code: "NOTIFY_SMTP_PERMANENT_REJECTION_EXCEPTION" 
                        }),
                    )
                } finally {
                    await moduleRef.close()
                    await server.close()
                }
            })

        it("maps a 4xx at RCPT TO to a transient failure, not a permanent one",
            async () => {
                const server = await startFakeSmtp({
                    rcptTo: "450 mailbox busy\r\n" 
                })
                const { moduleRef, client } = await boot(server.port)
                try {
                    await expect(client.send(message)).rejects.toThrow(
                        expect.objectContaining({
                            code: "NOTIFY_SMTP_TRANSIENT_FAILURE_EXCEPTION" 
                        }),
                    )
                } finally {
                    await moduleRef.close()
                    await server.close()
                }
            })
    })
