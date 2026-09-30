import { createServer } from "node:net"
import type { Server, Socket } from "node:net"
import { NotifySmtpError, NotifySmtpErrorCode } from "./errors/notify-smtp.error"
import { NotifySmtpClient } from "./notify-smtp.client"
import type { NotifySmtpOptions } from "./notify-smtp.options"

interface Script {
    readonly greeting?: string
    readonly ehlo?: string
    readonly mailFrom?: string
    readonly rcptTo?: string
    readonly data?: string
    readonly accepted?: string
    readonly silentAfterGreeting?: boolean
}

interface Loopback {
    readonly port: number
    readonly commands: Array<string>
    readonly dataLines: Array<string>
    close(): Promise<void>
}

const startLoopback = async (script: Script = {}): Promise<Loopback> => {
    const commands: Array<string> = []
    const dataLines: Array<string> = []
    const sockets = new Set<Socket>()
    const server: Server = createServer((socket) => {
        sockets.add(socket)
        socket.on("close", () => sockets.delete(socket))
        socket.on("error", () => socket.destroy())
        socket.write(script.greeting ?? "220 loopback ESMTP\r\n")
        let inData = false
        let buffer = ""
        socket.on("data", (chunk: Buffer) => {
            if (script.silentAfterGreeting) return
            buffer += chunk.toString("utf8")
            let end = buffer.indexOf("\r\n")
            while (end !== -1) {
                const line = buffer.slice(0, end)
                buffer = buffer.slice(end + 2)
                if (inData) {
                    if (line === ".") {
                        inData = false
                        socket.write(script.accepted ?? "250 queued\r\n")
                    } else {
                        dataLines.push(line)
                    }
                } else {
                    commands.push(line)
                    if (line.startsWith("EHLO")) socket.write(script.ehlo ?? "250-loopback greets you\r\n250 8BITMIME\r\n")
                    else if (line.startsWith("MAIL FROM")) socket.write(script.mailFrom ?? "250 OK\r\n")
                    else if (line.startsWith("RCPT TO")) socket.write(script.rcptTo ?? "250 OK\r\n")
                    else if (line === "DATA") {
                        inData = true
                        socket.write(script.data ?? "354 end with a dot\r\n")
                    } else if (line === "QUIT") socket.end("221 bye\r\n")
                }
                end = buffer.indexOf("\r\n")
            }
        })
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    return {
        port: address !== null && typeof address === "object" ? address.port : 0,
        commands,
        dataLines,
        close: () =>
            new Promise<void>((resolve) => {
                for (const socket of sockets) socket.destroy()
                server.close(() => resolve())
            }),
    }
}

const optionsFor = (port: number): NotifySmtpOptions => ({
    host: "127.0.0.1",
    port,
    from: "notify@todo.test",
    connectTimeoutMs: 1_000,
    commandTimeoutMs: 300,
})

const message = { to: "person-1@todo.test", subject: "Xin chao", body: "Hello\r\n.dotted line" }

const failureOf = async (work: Promise<void>): Promise<NotifySmtpError | null> => {
    try {
        await work
    } catch (error) {
        if (error instanceof NotifySmtpError) return error
        throw error
    }
    return null
}

describe("NotifySmtpClient", () => {
    let loopback: Loopback | undefined

    afterEach(async () => {
        await loopback?.close()
        loopback = undefined
    })

    it("runs the whole submission dialogue and sends an encoded message", async () => {
        loopback = await startLoopback()
        await new NotifySmtpClient(optionsFor(loopback.port)).send(message)
        expect(loopback.commands.slice(0, 4)).toEqual([
            "EHLO 127.0.0.1",
            "MAIL FROM:<notify@todo.test>",
            "RCPT TO:<person-1@todo.test>",
            "DATA",
        ])
        expect(loopback.dataLines).toContain("To: person-1@todo.test")
        expect(loopback.dataLines).toContain("Content-Transfer-Encoding: base64")
        const subject = loopback.dataLines.find((line) => line.startsWith("Subject: "))
        expect(subject).toMatch(/^Subject: =\?UTF-8\?B\?.+\?=$/)
        const encoded = loopback.dataLines.slice(loopback.dataLines.indexOf("") + 1).join("")
        expect(Buffer.from(encoded, "base64").toString("utf8")).toBe(message.body)
    })

    it("treats a 5xx answer to RCPT TO as a permanent rejection", async () => {
        loopback = await startLoopback({ rcptTo: "550 no such user\r\n" })
        const failure = await failureOf(new NotifySmtpClient(optionsFor(loopback.port)).send(message))
        expect(failure?.code).toBe(NotifySmtpErrorCode.PermanentRejection)
    })

    it("treats a 4xx answer to RCPT TO as transient", async () => {
        loopback = await startLoopback({ rcptTo: "450 mailbox busy\r\n" })
        const failure = await failureOf(new NotifySmtpClient(optionsFor(loopback.port)).send(message))
        expect(failure?.code).toBe(NotifySmtpErrorCode.TransientFailure)
        expect(failure?.params).toEqual({ reason: "450 mailbox busy" })
    })

    it("treats a 5xx answer at any other step as transient", async () => {
        loopback = await startLoopback({ mailFrom: "550 sender refused\r\n" })
        const failure = await failureOf(new NotifySmtpClient(optionsFor(loopback.port)).send(message))
        expect(failure?.code).toBe(NotifySmtpErrorCode.TransientFailure)
    })

    it("treats a refused connection as transient", async () => {
        loopback = await startLoopback()
        const { port } = loopback
        await loopback.close()
        loopback = undefined
        const failure = await failureOf(new NotifySmtpClient(optionsFor(port)).send(message))
        expect(failure?.code).toBe(NotifySmtpErrorCode.TransientFailure)
    })

    it("gives up on a host that stops answering", async () => {
        loopback = await startLoopback({ silentAfterGreeting: true })
        const failure = await failureOf(new NotifySmtpClient(optionsFor(loopback.port)).send(message))
        expect(failure?.code).toBe(NotifySmtpErrorCode.TransientFailure)
    })
})
