/**
 * The mail host at the network edge: a real SMTP server (RFC 5321 subset: greeting, EHLO, MAIL FROM, RCPT TO, DATA, QUIT)
 * on a loopback port. The application SMTP client runs unchanged against it and only `SMTP_HOST` / `SMTP_PORT` point
 * here. Accepted messages are decoded (RFC 2047 subject, base64 body) and kept for the specs; an armed failure answers the
 * next matching RCPT TO with a 4xx (transient) or 5xx (permanent) reply, or leaves the conversation silent.
 */
import { createServer } from "node:net"
import type { Socket } from "node:net"
import type { FailureSpec, RecordedRequest, SentMail } from "../fakes-control.contracts"
import { worldClock } from "../../kit/world-clock"
import { FailureQueue, RequestLog, listenLoopback } from "../fakes-http.service"

const CRLF = "\r\n"
const ENCODED_WORD = /^=\?UTF-8\?B\?(.+)\?=$/i
const ADDRESS = /<([^>]*)>/

const decodeWord = (value: string): string => {
    const match = ENCODED_WORD.exec(value.trim())
    return match?.[1] === undefined ? value.trim() : Buffer.from(match[1], "base64").toString("utf8")
}

const addressOf = (argument: string): string => ADDRESS.exec(argument)?.[1] ?? argument.trim()

/** The envelope of the message being received. */
interface Envelope {
    readonly from: string
    readonly to: string
}

/** What one conversation reads and writes: the shared log, the armed failures and the accepted mails. */
interface ConversationDeps {
    readonly log: RequestLog
    readonly failures: FailureQueue
    readonly accepted: Array<SentMail>
}

/** Turns the lines of a DATA section (already un-dot-stuffed) and the envelope into a decoded mail. */
const toMail = (envelope: Envelope, lines: ReadonlyArray<string>): SentMail => {
    const split = lines.indexOf("")
    const headerLines = split < 0 ? lines : lines.slice(0, split)
    const bodyLines = split < 0 ? [] : lines.slice(split + 1)
    const header = (name: string): string =>
        headerLines.find((line) => line.toLowerCase().startsWith(`${name.toLowerCase()}:`))?.slice(name.length + 1) ?? ""
    return {
        at: worldClock.now().toISOString(),
        from: envelope.from,
        to: envelope.to,
        subject: decodeWord(header("Subject")),
        body: Buffer.from(bodyLines.join(""), "base64").toString("utf8"),
    }
}

/** One conversation over one socket: the greeting goes out at once, then every command is answered as an SMTP host does. */
const converse = (socket: Socket, deps: ConversationDeps): void => {
    let buffer = ""
    let from = ""
    let to = ""
    let data: Array<string> | null = null
    let silent = false

    const reply = (text: string): void => {
        if (!silent) socket.write(`${text}${CRLF}`)
    }

    const recipient = (argument: string): void => {
        const address = addressOf(argument)
        const failure = deps.failures.takeInbound(address)
        if (failure?.timeout === true) {
            silent = true
            return
        }
        if (failure?.status !== undefined) {
            reply(`${failure.status} injected failure`)
            return
        }
        to = address
        reply("250 2.1.5 OK")
    }

    const command = (line: string): void => {
        const verb = line.split(" ")[0]?.toUpperCase() ?? ""
        const argument = line.slice(verb.length).trim()
        deps.log.record({ method: verb, path: argument, headers: {}, body: "" })
        if (silent) return
        if (verb === "EHLO" || verb === "HELO") socket.write(`250-fake-smtp${CRLF}250 8BITMIME${CRLF}`)
        else if (verb === "MAIL") {
            from = addressOf(argument)
            reply("250 2.1.0 OK")
        } else if (verb === "RCPT") recipient(argument)
        else if (verb === "DATA") {
            data = []
            reply("354 End data with <CR><LF>.<CR><LF>")
        } else if (verb === "QUIT") socket.end(`221 2.0.0 Bye${CRLF}`)
        else reply("502 5.5.2 Command not recognized")
    }

    const dataLine = (received: Array<string>, line: string): void => {
        if (line !== ".") {
            received.push(line.startsWith("..") ? line.slice(1) : line)
            return
        }
        deps.accepted.push(toMail({ from, to }, received))
        data = null
        reply("250 2.0.0 OK queued")
    }

    const feed = (chunk: string): void => {
        buffer += chunk
        for (let end = buffer.indexOf(CRLF); end >= 0; end = buffer.indexOf(CRLF)) {
            const line = buffer.slice(0, end)
            buffer = buffer.slice(end + CRLF.length)
            if (data === null) command(line)
            else dataLine(data, line)
        }
    }

    socket.on("data", (chunk: Buffer) => feed(chunk.toString("utf8")))
    socket.on("error", () => socket.destroy())
    reply("220 fake-smtp ESMTP ready")
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
        converse(socket, { log: this.log, failures: this.failures, accepted: this.accepted })
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
