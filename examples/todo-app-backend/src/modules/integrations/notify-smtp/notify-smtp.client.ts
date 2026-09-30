import { connect } from "node:net"
import type { Socket } from "node:net"
import { Injectable } from "@nestjs/common"
import { NotifySmtpError, NotifySmtpErrorCode } from "./errors/notify-smtp.error"
import type { NotifySmtpMessageParams, SmtpReply } from "./notify-smtp.contracts"
import { InjectNotifySmtpOptions } from "./notify-smtp.decorators"
import type { NotifySmtpOptions } from "./notify-smtp.options"

const REPLY_LINE = /^(\d{3})([ -])/
const BASE64_LINE_LENGTH = 76

const transient = (reason: string): NotifySmtpError =>
    new NotifySmtpError({ code: NotifySmtpErrorCode.TransientFailure, params: { reason } })

const singleLine = (value: string): string => value.replace(/[\r\n]+/g, " ").trim()

const encodeHeader = (value: string): string =>
    `=?UTF-8?B?${Buffer.from(singleLine(value), "utf8").toString("base64")}?=`

const encodeBody = (value: string): string =>
    (
        Buffer.from(value, "utf8")
            .toString("base64")
            .match(new RegExp(`.{1,${BASE64_LINE_LENGTH}}`, "g")) ?? []
    ).join("\r\n")

/** Takes the first complete reply (every line up to the one whose code is followed by a space) off the buffered text. */
const takeReply = (buffered: string): { readonly reply: SmtpReply; readonly rest: string } | null => {
    const lines = buffered.split("\r\n")
    const complete = lines.slice(0, -1)
    for (let index = 0; index < complete.length; index += 1) {
        const match = REPLY_LINE.exec(complete[index] ?? "")
        if (match?.[2] === " ") {
            return {
                reply: { code: Number(match[1]), text: complete.slice(0, index + 1).join("\n") },
                rest: lines.slice(index + 1).join("\r\n"),
            }
        }
    }
    return null
}

/** What a channel is built over. */
interface SmtpChannelParams {
    readonly socket: Socket
}

/** One SMTP conversation over one socket: commands out, replies in, silences bounded by the socket idle timeout. */
class SmtpChannel {
    private buffer = ""
    private failure: Error | null = null
    private readonly socket: Socket

    constructor(params: SmtpChannelParams) {
        this.socket = params.socket
        this.socket.on("error", (error: Error) => {
            this.failure = error
        })
    }

    /** Opens the connection; a refusal, an error or a silence longer than `timeoutMs` is a transient failure. */
    static open(options: NotifySmtpOptions): Promise<SmtpChannel> {
        return new Promise((resolve, reject) => {
            const socket = connect({ host: options.host, port: options.port })
            socket.setTimeout(options.connectTimeoutMs)
            const cleanup = (): void => {
                socket.off("connect", onConnect)
                socket.off("error", onError)
                socket.off("timeout", onTimeout)
            }
            const onConnect = (): void => {
                cleanup()
                socket.setTimeout(options.commandTimeoutMs)
                resolve(new SmtpChannel({ socket }))
            }
            const onError = (error: Error): void => {
                cleanup()
                socket.destroy()
                reject(transient(error.message))
            }
            const onTimeout = (): void => {
                cleanup()
                socket.destroy()
                reject(transient("connection timed out"))
            }
            socket.once("connect", onConnect)
            socket.once("error", onError)
            socket.once("timeout", onTimeout)
        })
    }

    /** Reads one complete reply. */
    read(): Promise<SmtpReply> {
        return new Promise((resolve, reject) => {
            const cleanup = (): void => {
                this.socket.off("data", onData)
                this.socket.off("error", onError)
                this.socket.off("timeout", onTimeout)
                this.socket.off("close", onClose)
            }
            const tryTake = (): boolean => {
                const taken = takeReply(this.buffer)
                if (!taken) return false
                this.buffer = taken.rest
                cleanup()
                resolve(taken.reply)
                return true
            }
            const onData = (chunk: Buffer): void => {
                this.buffer += chunk.toString("utf8")
                tryTake()
            }
            const onError = (error: Error): void => {
                cleanup()
                reject(transient(error.message))
            }
            const onTimeout = (): void => {
                cleanup()
                reject(transient("no answer from the mail host"))
            }
            const onClose = (): void => {
                cleanup()
                reject(transient("connection closed by the mail host"))
            }
            if (tryTake()) return
            if (this.failure) {
                reject(transient(this.failure.message))
                return
            }
            this.socket.on("data", onData)
            this.socket.on("error", onError)
            this.socket.on("timeout", onTimeout)
            this.socket.on("close", onClose)
        })
    }

    /** Writes one command line and reads its reply. */
    command(line: string): Promise<SmtpReply> {
        this.socket.write(`${line}\r\n`)
        return this.read()
    }

    /** Says goodbye without waiting for the answer: the message was already accepted. */
    quit(): void {
        this.socket.end("QUIT\r\n")
    }

    /** Drops the connection after a failure. */
    abort(): void {
        this.socket.destroy()
    }
}

/** A step that must be answered with `code`; anything else is a transient refusal carrying the host's text. */
const expectCode = (reply: SmtpReply, code: number): void => {
    if (reply.code !== code) throw transient(reply.text)
}

/** RCPT TO is the one step whose 5xx answer permanently rejects the address; every other refusal is transient. */
const expectRecipient = (reply: SmtpReply): void => {
    if (reply.code === 250) return
    if (reply.code >= 500 && reply.code < 600) {
        throw new NotifySmtpError({ code: NotifySmtpErrorCode.PermanentRejection, params: { reason: reply.text } })
    }
    throw transient(reply.text)
}

@Injectable()
/**
 * The only file that speaks SMTP: EHLO, MAIL FROM, RCPT TO, DATA and QUIT over a plain socket. The subject and the body
 * travel UTF-8 encoded (RFC 2047 subject, base64 body), so Vietnamese text is safe. A connection failure, a silence or
 * a 4xx answer is a transient failure; a 5xx answer to RCPT TO is a permanent rejection of the address.
 */
export class NotifySmtpClient {
    constructor(@InjectNotifySmtpOptions() private readonly options: NotifySmtpOptions) {}

    /** Hands one message to the mail host; resolves when the host accepted it, throws a NotifySmtpError otherwise. */
    async send(message: NotifySmtpMessageParams): Promise<void> {
        const { from, host } = this.options
        const channel = await SmtpChannel.open(this.options)
        try {
            expectCode(await channel.read(), 220)
            expectCode(await channel.command(`EHLO ${host}`), 250)
            expectCode(await channel.command(`MAIL FROM:<${singleLine(from)}>`), 250)
            expectRecipient(await channel.command(`RCPT TO:<${singleLine(message.to)}>`))
            expectCode(await channel.command("DATA"), 354)
            const data = [
                `From: ${singleLine(from)}`,
                `To: ${singleLine(message.to)}`,
                `Subject: ${encodeHeader(message.subject)}`,
                "MIME-Version: 1.0",
                "Content-Type: text/plain; charset=utf-8",
                "Content-Transfer-Encoding: base64",
                "",
                encodeBody(message.body),
                ".",
            ].join("\r\n")
            expectCode(await channel.command(data), 250)
            channel.quit()
        } catch (error) {
            channel.abort()
            throw error
        }
    }
}
