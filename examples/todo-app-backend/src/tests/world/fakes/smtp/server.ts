/**
 * The mail host at the network edge: a real SMTP server (RFC 5321 subset: greeting, EHLO, MAIL FROM, RCPT TO, DATA, QUIT)
 * on a loopback port. The application SMTP client runs unchanged against it and only `SMTP_HOST` / `SMTP_PORT` point
 * here. Accepted messages are decoded (RFC 2047 subject, base64 body) and kept for the specs; an armed failure answers the
 * next matching RCPT TO with a 4xx (transient) or 5xx (permanent) reply, or leaves the conversation silent.
 */
import { createServer } from "node:net"
import type { Socket } from "node:net"
import type { FailureSpec, RecordedRequest, SentMail } from "../fakes-control.contracts"
import { FailureQueue, RequestLog, listenLoopback } from "../fakes-http.service"

const CRLF = "\r\n"
const ENCODED_WORD = /^=\?UTF-8\?B\?(.+)\?=$/i
const ADDRESS = /<([^>]*)>/

const decodeWord = (value: string): string => {
    const match = ENCODED_WORD.exec(value.trim())
    return match?.[1] === undefined ? value.trim() : Buffer.from(match[1], "base64").toString("utf8")
}

const addressOf = (argument: string): string => ADDRESS.exec(argument)?.[1] ?? argument.trim()

/** Turns the lines of a DATA section (already un-dot-stuffed) and the envelope into a decoded mail. */
const toMail = (envelope: { readonly from: string; readonly to: string }, lines: ReadonlyArray<string>): SentMail => {
    const split = lines.indexOf("")
    const headerLines = split < 0 ? lines : lines.slice(0, split)
    const bodyLines = split < 0 ? [] : lines.slice(split + 1)
    const header = (name: string): string =>
        headerLines.find((line) => line.toLowerCase().startsWith(`${name.toLowerCase()}:`))?.slice(name.length + 1) ?? ""
    return {
        at: new Date().toISOString(),
        from: envelope.from,
        to: envelope.to,
        subject: decodeWord(header("Subject")),
        body: Buffer.from(bodyLines.join(""), "base64").toString("utf8"),
    }
}

/** One conversation over one socket. */
class Conversation {
    private buffer = ""
    private from = ""
    private to = ""
    private data: Array<string> | null = null
    private silent = false

    private constructor(
        private readonly socket: Socket,
        private readonly log: RequestLog,
        private readonly failures: FailureQueue,
        private readonly accepted: Array<SentMail>,
    ) {
        socket.on("data", (chunk: Buffer) => this.feed(chunk.toString("utf8")))
        socket.on("error", () => socket.destroy())
        this.reply("220 fake-smtp ESMTP ready")
    }

    /** Starts the conversation on an accepted socket: the greeting goes out at once. */
    static attach(socket: Socket, log: RequestLog, failures: FailureQueue, accepted: Array<SentMail>): Conversation {
        return new Conversation(socket, log, failures, accepted)
    }

    private reply(text: string): void {
        if (!this.silent) this.socket.write(`${text}${CRLF}`)
    }

    private feed(chunk: string): void {
        this.buffer += chunk
        for (let end = this.buffer.indexOf(CRLF); end >= 0; end = this.buffer.indexOf(CRLF)) {
            const line = this.buffer.slice(0, end)
            this.buffer = this.buffer.slice(end + CRLF.length)
            if (this.data === null) this.command(line)
            else this.dataLine(line)
        }
    }

    private dataLine(line: string): void {
        if (line !== ".") {
            this.data?.push(line.startsWith("..") ? line.slice(1) : line)
            return
        }
        this.accepted.push(toMail({ from: this.from, to: this.to }, this.data ?? []))
        this.data = null
        this.reply("250 2.0.0 OK queued")
    }

    private command(line: string): void {
        const verb = line.split(" ")[0]?.toUpperCase() ?? ""
        const argument = line.slice(verb.length).trim()
        this.log.record({ method: verb, path: argument, headers: {}, body: "" })
        if (this.silent) return
        if (verb === "EHLO" || verb === "HELO") this.socket.write(`250-fake-smtp${CRLF}250 8BITMIME${CRLF}`)
        else if (verb === "MAIL") this.mailFrom(argument)
        else if (verb === "RCPT") this.recipient(argument)
        else if (verb === "DATA") this.startData()
        else if (verb === "QUIT") this.socket.end(`221 2.0.0 Bye${CRLF}`)
        else this.reply("502 5.5.2 Command not recognized")
    }

    private mailFrom(argument: string): void {
        this.from = addressOf(argument)
        this.reply("250 2.1.0 OK")
    }

    private recipient(argument: string): void {
        const address = addressOf(argument)
        const failure = this.failures.takeInbound(address)
        if (failure?.timeout === true) {
            this.silent = true
            return
        }
        if (failure?.status !== undefined) {
            this.reply(`${failure.status} injected failure`)
            return
        }
        this.to = address
        this.reply("250 2.1.5 OK")
    }

    private startData(): void {
        this.data = []
        this.reply("354 End data with <CR><LF>.<CR><LF>")
    }
}

/** The SMTP host fake. */
export class SmtpFake {
    private readonly log = new RequestLog()
    private readonly failures = new FailureQueue()
    private readonly accepted: Array<SentMail> = []
    private readonly sockets = new Set<Socket>()
    private readonly server = createServer((socket) => {
        this.sockets.add(socket)
        socket.once("close", () => this.sockets.delete(socket))
        Conversation.attach(socket, this.log, this.failures, this.accepted)
    })
    private listening = 0

    /** Binds the loopback port. */
    async listen(): Promise<void> {
        this.listening = await listenLoopback(this.server)
    }

    /** Stops the server and drops every open conversation. */
    close(): Promise<void> {
        return new Promise((resolve) => {
            this.server.close(() => resolve())
            for (const socket of this.sockets) socket.destroy()
        })
    }

    /** The port the application is configured with. */
    get port(): number {
        return this.listening
    }

    /** Arms a failure for the next matching RCPT TO. */
    failNext(spec: FailureSpec): void {
        this.failures.push(spec)
    }

    /** The messages accepted so far, oldest first. */
    mails(): ReadonlyArray<SentMail> {
        return [...this.accepted]
    }

    /** The commands received so far. */
    requests(): ReadonlyArray<RecordedRequest> {
        return this.log.all()
    }
}
