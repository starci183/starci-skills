import assert from "node:assert/strict"
import { connect } from "node:net"
import type { Socket } from "node:net"
import { test } from "node:test"
import type { FakeStartContext } from "../../framework/contracts"
import { smtpFake } from "./index"
import type { SentMail } from "./index"

const start: FakeStartContext = { runId: "run", secret: (label) => label, now: () => new Date() }

/** A raw line-oriented SMTP client. */
class Raw {
    private buffer = ""

    private constructor(private readonly socket: Socket) {
        socket.setEncoding("utf8")
        socket.on("data", (chunk: string) => {
            this.buffer += chunk
        })
    }

    static async open(port: number): Promise<Raw> {
        const socket = connect(port, "127.0.0.1")
        await new Promise<void>((resolve) => socket.once("connect", resolve))
        return new Raw(socket)
    }

    /** Reads until a final reply line (`ddd text`, not `ddd-text`). */
    async reply(timeoutMs = 2000): Promise<string> {
        const deadline = Date.now() + timeoutMs
        while (Date.now() < deadline) {
            const lines = this.buffer.split("\r\n")
            const finalIndex = lines.findIndex((line) => /^\d{3} /.test(line))
            if (finalIndex >= 0) {
                const taken = lines.slice(0, finalIndex + 1)
                this.buffer = lines.slice(finalIndex + 1).join("\r\n")
                return taken.join("\n")
            }
            await new Promise((resolve) => setTimeout(resolve, 5))
        }
        return "TIMEOUT"
    }

    async send(line: string): Promise<string> {
        this.socket.write(`${line}\r\n`)
        return this.reply()
    }

    raw(text: string): void {
        this.socket.write(text)
    }

    close(): void {
        this.socket.destroy()
    }
}

type Control = (action: string, body?: unknown) => Promise<unknown>

const withFake = async (run: (port: number, control: Control) => Promise<void>): Promise<void> => {
    const instance = await smtpFake().start(start)
    try {
        await run(instance.port, (action, body) => instance.control(action, body))
    } finally {
        await instance.close()
    }
}

const MESSAGE = [
    "From: Shop <shop@example.com>",
    "To: Ann <ann@example.com>, bob@example.com",
    "Cc: cc@example.com",
    "Subject: =?UTF-8?B?Q2Fmw6k=?= =?UTF-8?Q?_order_=E2=82=AC5?=",
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="MIX"',
    "",
    "--MIX",
    'Content-Type: multipart/alternative; boundary="ALT"',
    "",
    "--ALT",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from("plain text ok").toString("base64"),
    "--ALT",
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    '<p style=3D"color:red">caf=C3=A9 long line that is soft wrapped =',
    "here</p>",
    "--ALT--",
    "--MIX",
    'Content-Type: application/pdf; name="a.pdf"',
    'Content-Disposition: attachment; filename="a.pdf"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from("PDFBYTES").toString("base64"),
    "--MIX--",
    "",
    ".dot line",
]

test("a full conversation is decoded: RFC 2047 subject, base64 text, quoted-printable html, attachment, dot-stuffing", async () => {
    await withFake(async (port, control) => {
        const client = await Raw.open(port)
        assert.match(await client.reply(), /^220 /)
        assert.match(await client.send("EHLO test"), /AUTH PLAIN LOGIN/)
        assert.match(await client.send("AUTH PLAIN AGEAYg=="), /^235/)
        assert.match(await client.send("MAIL FROM:<shop@example.com>"), /^250/)
        assert.match(await client.send("RCPT TO:<ann@example.com>"), /^250/)
        assert.match(await client.send("RCPT TO:<bob@example.com>"), /^250/)
        assert.match(await client.send("DATA"), /^354/)
        // The line ".dot line" goes on the wire dot-stuffed as "..dot line".
        client.raw(`${MESSAGE.map((line) => (line.startsWith(".") ? `.${line}` : line)).join("\r\n")}\r\n.\r\n`)
        assert.match(await client.reply(), /^250/)
        assert.match(await client.send("NOOP"), /^250/)
        assert.match(await client.send("RSET"), /^250/)
        assert.match(await client.send("QUIT"), /^221/)
        client.close()

        const mails = (await control("mails")) as ReadonlyArray<SentMail>
        assert.equal(mails.length, 1)
        const mail = mails[0]
        assert.ok(mail)
        assert.equal(mail.subject, "Caf\u00e9 order €5")
        assert.equal(mail.from, "shop@example.com")
        assert.deepEqual(mail.to, ["ann@example.com", "bob@example.com"])
        assert.deepEqual(mail.cc, ["cc@example.com"])
        assert.deepEqual(mail.envelope, { from: "shop@example.com", to: ["ann@example.com", "bob@example.com"] })
        assert.equal(mail.text, "plain text ok")
        assert.equal(mail.html, '<p style="color:red">caf\u00e9 long line that is soft wrapped here</p>')
        assert.equal(mail.attachments.length, 1)
        assert.equal(mail.attachments[0]?.filename, "a.pdf")
        assert.equal(mail.attachments[0]?.size, 8)
        assert.equal(Buffer.from(mail.attachments[0]?.contentBase64 ?? "", "base64").toString(), "PDFBYTES")
        assert.ok(mail.raw.includes("\r\n.dot line"), "dot-unstuffed in the raw message")
        assert.ok(!mail.raw.includes("..dot line"))

        const log = (await control("requests")) as ReadonlyArray<{ method: string; status: number }>
        assert.deepEqual(
            log.slice(0, 3).map((entry) => entry.method),
            ["EHLO", "AUTH", "MAIL"],
        )
        assert.equal(log.find((entry) => entry.method === "DATA")?.status, 250)
    })
})

test("a plain 7bit message and AUTH LOGIN", async () => {
    await withFake(async (port, control) => {
        const client = await Raw.open(port)
        await client.reply()
        await client.send("HELO x")
        assert.match(await client.send("AUTH LOGIN"), /^334 VXNlcm5hbWU6/)
        assert.match(await client.send("dXNlcg=="), /^334 UGFzc3dvcmQ6/)
        assert.match(await client.send("cGFzcw=="), /^235/)
        await client.send("MAIL FROM:<a@x.io>")
        await client.send("RCPT TO:<b@x.io>")
        await client.send("DATA")
        client.raw("Subject: hi\r\nFrom: a@x.io\r\nTo: b@x.io\r\n\r\nhello\r\n.\r\n")
        await client.reply()
        client.close()
        const mails = (await control("mails")) as ReadonlyArray<SentMail>
        assert.equal(mails[0]?.text, "hello")
        assert.equal(mails[0]?.subject, "hi")
    })
})

test("failNext answers the next RCPT TO with the reply code, honours times and match.method", async () => {
    await withFake(async (port, control) => {
        await control("fail-next", { status: 452, times: 2 })
        const client = await Raw.open(port)
        await client.reply()
        await client.send("EHLO x")
        await client.send("MAIL FROM:<a@x.io>")
        assert.match(await client.send("RCPT TO:<b@x.io>"), /^452 /)
        assert.match(await client.send("RCPT TO:<b@x.io>"), /^452 /)
        assert.match(await client.send("RCPT TO:<b@x.io>"), /^250/)
        await control("fail-next", { status: 554, match: { method: "MAIL" } })
        assert.match(await client.send("MAIL FROM:<a@x.io>"), /^554 /)
        assert.match(await client.send("MAIL FROM:<a@x.io>"), /^250/)
        client.close()
        const log = (await control("requests")) as ReadonlyArray<{ method: string; status: number }>
        assert.equal(log.filter((entry) => entry.status === 452).length, 2)
    })
})

test("failNext timeout leaves the conversation silent; reset clears mails and failures", async () => {
    await withFake(async (port, control) => {
        await control("fail-next", { timeout: true, match: { method: "MAIL" } })
        const client = await Raw.open(port)
        await client.reply()
        await client.send("EHLO x")
        client.raw("MAIL FROM:<a@x.io>\r\n")
        assert.equal(await client.reply(300), "TIMEOUT")
        client.close()
        await control("fail-next", { status: 550 })
        await control("reset", {})
        const second = await Raw.open(port)
        await second.reply()
        await second.send("EHLO x")
        await second.send("MAIL FROM:<a@x.io>")
        assert.match(await second.send("RCPT TO:<b@x.io>"), /^250/)
        second.close()
        assert.deepEqual(await control("mails"), [])
    })
})
