/** A small MIME decoder: headers (RFC 5322 folding, RFC 2047 words), multipart trees, quoted-printable and base64 bodies. */

/** One attachment found in a message. */
export interface MailAttachment {
    readonly filename: string
    readonly contentType: string
    /** Decoded size in bytes. */
    readonly size: number
    /** The decoded content, base64. */
    readonly contentBase64: string
}

/** A decoded message. */
export interface ParsedMessage {
    /** Header values by lower-case name (RFC 2047 decoded; repeated headers joined by `, `). */
    readonly headers: Readonly<Record<string, string>>
    readonly subject: string
    /** Addresses only (`a@b.c`), from the From/To/Cc headers. */
    readonly from: string
    readonly to: ReadonlyArray<string>
    readonly cc: ReadonlyArray<string>
    /** The first text/plain part, "" when none. */
    readonly text: string
    /** The first text/html part, "" when none. */
    readonly html: string
    readonly attachments: ReadonlyArray<MailAttachment>
}

const decodeCharset = (bytes: Buffer, charset: string): string => {
    try {
        return new TextDecoder(charset || "utf-8").decode(bytes)
    } catch {
        return bytes.toString("utf8")
    }
}

/** Decodes the bytes of a quoted-printable body (RFC 2045). */
export const decodeQuotedPrintable = (input: string): Buffer => {
    const text = input.replace(/=\r?\n/g, "")
    const bytes: Array<number> = []
    for (let index = 0; index < text.length; index += 1) {
        const char = text.charAt(index)
        const hex = text.slice(index + 1, index + 3)
        if (char === "=" && /^[0-9A-Fa-f]{2}$/.test(hex)) {
            bytes.push(Number.parseInt(hex, 16))
            index += 2
        } else {
            for (const byte of Buffer.from(char, "utf8")) bytes.push(byte)
        }
    }
    return Buffer.from(bytes)
}

/** Decodes RFC 2047 encoded words (`=?utf-8?B?...?=`, `=?utf-8?Q?...?=`) inside a header value. */
export const decodeEncodedWords = (value: string): string =>
    value
        .replace(/(=\?[^?]+\?[bBqQ]\?[^?]*\?=)\s+(?==\?[^?]+\?[bBqQ]\?[^?]*\?=)/g, "$1")
        .replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_whole, charset: string, encoding: string, payload: string) => {
            const bytes =
                encoding.toUpperCase() === "B"
                    ? Buffer.from(payload, "base64")
                    : decodeQuotedPrintable(payload.replaceAll("_", " "))
            return decodeCharset(bytes, charset.split("*")[0] ?? "utf-8")
        })

/** Splits a header block into `[name, unfolded value]` pairs. */
const parseHeaderBlock = (block: string): Array<[string, string]> => {
    const pairs: Array<[string, string]> = []
    for (const line of block.split(/\r?\n/)) {
        if (/^[ \t]/.test(line) && pairs.length > 0) {
            const last = pairs.at(-1)
            if (last !== undefined) last[1] += ` ${line.trim()}`
            continue
        }
        const colon = line.indexOf(":")
        if (colon > 0) pairs.push([line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()])
    }
    return pairs
}

/** Splits a text at its first blank line. */
const splitEntity = (text: string): { readonly head: string; readonly body: string } => {
    const match = /\r?\n\r?\n/.exec(text)
    if (match === null) return { head: text, body: "" }
    return { head: text.slice(0, match.index), body: text.slice(match.index + match[0].length) }
}

/** The main value and the parameters of a structured header (`text/plain; charset=utf-8`). */
const parseStructured = (value: string): { readonly main: string; readonly params: Record<string, string> } => {
    const parts: Array<string> = []
    let current = ""
    let quoted = false
    for (const char of value) {
        if (char === '"') quoted = !quoted
        if (char === ";" && !quoted) {
            parts.push(current)
            current = ""
        } else current += char
    }
    parts.push(current)
    const params: Record<string, string> = {}
    for (const part of parts.slice(1)) {
        const equals = part.indexOf("=")
        if (equals < 0) continue
        const key = part.slice(0, equals).trim().toLowerCase()
        let raw = part.slice(equals + 1).trim()
        if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) raw = raw.slice(1, -1)
        if (key.endsWith("*")) {
            const match = /^([^']*)'[^']*'(.*)$/.exec(raw)
            const charset = match?.[1] ?? "utf-8"
            const encoded = match?.[2] ?? raw
            params[key.slice(0, -1)] = decodeCharset(Buffer.from(encoded.replace(/%([0-9A-Fa-f]{2})/g, (_w, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16))), "latin1"), charset)
        } else params[key] = raw
    }
    return { main: (parts[0] ?? "").trim().toLowerCase(), params }
}

/** The bare addresses of an address-list header value. */
export const parseAddresses = (value: string): Array<string> => {
    const items: Array<string> = []
    let current = ""
    let quoted = false
    let angle = 0
    for (const char of value) {
        if (char === '"') quoted = !quoted
        else if (!quoted && char === "<") angle += 1
        else if (!quoted && char === ">") angle -= 1
        if (char === "," && !quoted && angle === 0) {
            items.push(current)
            current = ""
        } else current += char
    }
    items.push(current)
    const addresses: Array<string> = []
    for (const item of items) {
        const bracket = /<([^>]*)>/.exec(item)
        const address = (bracket?.[1] ?? item).trim()
        if (address !== "" && /@/.test(address)) addresses.push(address)
    }
    return addresses
}

interface Collected {
    text: string | null
    html: string | null
    readonly attachments: Array<MailAttachment>
}

const decodeBody = (body: string, encoding: string): Buffer => {
    if (encoding === "base64") return Buffer.from(body.replace(/\s+/g, ""), "base64")
    if (encoding === "quoted-printable") return decodeQuotedPrintable(body)
    return Buffer.from(body, "utf8")
}

const walk = (entity: string, collected: Collected, defaultType: string): void => {
    const { head, body } = splitEntity(entity)
    const headers = new Map(parseHeaderBlock(head))
    const type = parseStructured(headers.get("content-type") ?? defaultType)
    if (type.main.startsWith("multipart/") && type.params["boundary"] !== undefined) {
        const boundary = type.params["boundary"]
        const lines = body.split(/\r?\n/)
        let current: Array<string> | null = null
        for (const line of lines) {
            if (line === `--${boundary}--`) {
                if (current !== null) walk(current.join("\r\n"), collected, type.main === "multipart/digest" ? "message/rfc822" : "text/plain")
                current = null
                break
            }
            if (line === `--${boundary}`) {
                if (current !== null) walk(current.join("\r\n"), collected, "text/plain")
                current = []
            } else current?.push(line)
        }
        if (current !== null) walk(current.join("\r\n"), collected, "text/plain")
        return
    }
    const encoding = (headers.get("content-transfer-encoding") ?? "7bit").trim().toLowerCase()
    const bytes = decodeBody(body, encoding)
    const disposition = parseStructured(headers.get("content-disposition") ?? "")
    const filename = disposition.params["filename"] ?? type.params["name"]
    const isAttachment = disposition.main === "attachment" || filename !== undefined || !type.main.startsWith("text/")
    if (isAttachment) {
        collected.attachments.push({
            filename: decodeEncodedWords(filename ?? ""),
            contentType: type.main,
            size: bytes.length,
            contentBase64: bytes.toString("base64"),
        })
        return
    }
    const text = decodeCharset(bytes, type.params["charset"] ?? "utf-8")
    if (type.main === "text/html") collected.html ??= text
    else collected.text ??= text
}

/** Decodes a whole RFC 5322 message. */
export const parseMessage = (raw: string): ParsedMessage => {
    const { head } = splitEntity(raw)
    const merged: Record<string, string> = {}
    for (const [name, value] of parseHeaderBlock(head)) {
        const decoded = decodeEncodedWords(value)
        merged[name] = merged[name] === undefined ? decoded : `${merged[name]}, ${decoded}`
    }
    const collected: Collected = { text: null, html: null, attachments: [] }
    walk(raw, collected, "text/plain")
    return {
        headers: merged,
        subject: merged["subject"] ?? "",
        from: parseAddresses(merged["from"] ?? "")[0] ?? "",
        to: parseAddresses(merged["to"] ?? ""),
        cc: parseAddresses(merged["cc"] ?? ""),
        text: collected.text ?? "",
        html: collected.html ?? "",
        attachments: collected.attachments,
    }
}
