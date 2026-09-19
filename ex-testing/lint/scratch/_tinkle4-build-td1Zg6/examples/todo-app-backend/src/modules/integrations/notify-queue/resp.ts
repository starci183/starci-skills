import {
    NotifyQueueProtocolException 
} from "@modules/shared/exceptions/errors/notify/notify-queue-protocol"

/**
 * A minimal RESP (REdis Serialization Protocol) codec - just enough to send a command array and parse
 * back a simple string, error, integer, bulk string or array reply. Chosen over adding `ioredis`/`redis`
 * for the same reason `notify-smtp.client.ts` speaks raw SMTP instead of adding `nodemailer`: this host
 * cannot reliably reach npm to add a fresh dependency, and the handful of commands this integration needs
 * (EVAL, for one atomic script) do not need a full client library.
 */
export function encodeCommand(args: Array<string>): string {
    let out = `*${args.length}\r\n`
    for (const arg of args) {
        out += `$${Buffer.byteLength(arg,
            "utf8")}\r\n${arg}\r\n`
    }
    return out
}

/** Contract naming the parse result shape integrations/notify-queue code and its consumers share; a second site never retypes it inline. */
export interface ParseResult {
  readonly value: unknown;
  readonly next: number;
}

/** Parses one RESP value starting at `offset`. Returns null when `buf` does not yet contain a complete
 * value (the caller should wait for more data and retry from the same offset). */
export function tryParse(buf: string, offset: number): ParseResult | null {
    if (offset >= buf.length) return null
    const type = buf[offset]
    const eol = buf.indexOf("\r\n",
        offset)
    if (eol === -1) return null
    const head = buf.slice(offset + 1,
        eol)
    const afterHead = eol + 2

    switch (type) {
    case "+":
        return {
            value: head, next: afterHead 
        }
    case "-":
        return {
            value: new Error(head), next: afterHead 
        }
    case ":":
        return {
            value: Number.parseInt(head,
                10), next: afterHead 
        }
    case "$": {
        const len = Number.parseInt(head,
            10)
        if (len === -1) return {
            value: null, next: afterHead 
        }
        if (buf.length < afterHead + len + 2) return null
        return {
            value: buf.slice(afterHead,
                afterHead + len), next: afterHead + len + 2 
        }
    }
    case "*": {
        const count = Number.parseInt(head,
            10)
        if (count === -1) return {
            value: null, next: afterHead 
        }
        let cursor = afterHead
        const items: Array<unknown> = []
        for (let i = 0; i < count; i += 1) {
            const result = tryParse(buf,
                cursor)
            if (!result) return null
            items.push(result.value)
            cursor = result.next
        }
        return {
            value: items, next: cursor 
        }
    }
    default:
        throw new NotifyQueueProtocolException({
            typeByte: type,
        })
    }
}
