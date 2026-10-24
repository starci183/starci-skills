import { createHmac, timingSafeEqual } from "node:crypto"
import type { CursorReading, Page, PageCursor, PageRequest } from "./page.contracts"

/** The longest cursor a client may send back: a signed keyset position is far shorter. */
export const CURSOR_LENGTH_MAX = 512

const PART_SEPARATOR = "."

const macOf = (body: string, key: string): Buffer => createHmac("sha256", key).update(body).digest()

/** What a cursor body decodes to: the JSON it holds, or the cause when it is not base64url JSON. */
interface ParsedBody {
    readonly value: unknown
    readonly cause: unknown
}

const parseBody = (body: string): ParsedBody => {
    try {
        return { value: JSON.parse(Buffer.from(body, "base64url").toString("utf8")), cause: null }
    } catch (cause) {
        return { value: null, cause }
    }
}

/** The position a verified cursor body names, or null when the body is not a `[sortValue, id]` pair of strings. */
const positionOf = (body: string): CursorReading => {
    const { value } = parseBody(body)
    if (!Array.isArray(value)) return null
    const pair: ReadonlyArray<unknown> = value
    const [sortValue, id] = pair
    return pair.length === 2 && typeof sortValue === "string" && typeof id === "string" ? { sortValue, id } : null
}

/** The opaque cursor of a keyset position: its body and an HMAC-SHA256 of it under `key`, so a client cannot forge or edit one. */
export const encodeCursor = (position: PageCursor, key: string): string => {
    const body = Buffer.from(JSON.stringify([position.sortValue, position.id])).toString("base64url")
    return `${body}${PART_SEPARATOR}${macOf(body, key).toString("base64url")}`
}

/** The position a cursor names, or null when it is malformed or was not signed with `key`. */
export const decodeCursor = (token: string, key: string): CursorReading => {
    const [body, mac, extra]: ReadonlyArray<string | undefined> = token.split(PART_SEPARATOR)
    if (body === undefined || mac === undefined || extra !== undefined || body === "") return null
    const expected = macOf(body, key)
    const given = Buffer.from(mac, "base64url")
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
    return positionOf(body)
}

/**
 * Builds the page from the rows one read fetched: the read asked for `first + 1` rows, the extra one only proves that a next
 * page exists and is never shown. The end cursor signs the position of the last row shown.
 */
export const pageOf = <Row, Item>(rows: ReadonlyArray<Row>, request: PageRequest<Row, Item>): Page<Item> => {
    const shown = rows.slice(0, request.first)
    const last = shown.at(-1)
    return {
        items: shown.map(request.itemOf),
        endCursor: last === undefined ? null : encodeCursor(request.positionOf(last), request.key),
        hasNextPage: rows.length > request.first,
    }
}
