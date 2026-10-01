import type { Outcome } from "./outcome"

/** How long a request waits, unless it asks for more, before it is abandoned and answered `unavailable`. */
const DEFAULT_TIMEOUT_MS = 2500

/** The codes the backends use when the caller has no live session, a wrong pair, or may not do what it asked. */
const REFUSED_CODES: ReadonlyArray<string> = [
    "SESSION_INVALID",
    "ACCOUNT_INVALID_CREDENTIALS",
    "IDENTITY_UNAUTHENTICATED",
    "IDENTITY_FORBIDDEN",
]

/** One request of the client: the caller's own signal is joined with the timeout. */
export interface ClientRequest {
    readonly url: string
    readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
    readonly body?: unknown
    /** The session bearer, sent as `Authorization: Bearer <token>`. */
    readonly token?: string | null
    /** How long the request waits, in milliseconds; a call that itself waits on a service asks for more than the default. */
    readonly timeoutMs?: number
    readonly signal?: AbortSignal
}

/** One GraphQL operation: the service's base URL, the document text, its variables and the caller's bearer. */
export interface GraphqlRequest {
    readonly baseUrl: string
    readonly document: string
    readonly variables?: Readonly<Record<string, unknown>>
    readonly token?: string | null
    readonly signal?: AbortSignal
}

/** True for a plain JSON object; the one guard every reader narrows an `unknown` body with. */
export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * The stable code and the parameters of a refusal body, whichever shape carried them: a GraphQL error
 * (`extensions.code` and `extensions.params`, as the backends' error formatter writes them) or the flat
 * `{ code, details }` body the shop's own doors answer.
 */
const refusalOf = (body: unknown): { readonly code?: string; readonly details?: Readonly<Record<string, unknown>> } => {
    if (!isRecord(body)) return {}
    if (isRecord(body.extensions)) {
        const { code, params } = body.extensions
        return {
            ...(typeof code === "string" ? { code } : {}),
            ...(isRecord(params) && Object.keys(params).length > 0 ? { details: params } : {}),
        }
    }
    return {
        ...(typeof body.code === "string" ? { code: body.code } : {}),
        ...(isRecord(body.details) ? { details: body.details } : {}),
    }
}

/** A refusal body as an Outcome: a missing-session code is `refused`, a `_NOT_FOUND` code is `not-found`, the rest is the door's own named refusal. */
const refusalOutcome = (body: unknown): Outcome<never> => {
    const { code, details } = refusalOf(body)
    if (code !== undefined && REFUSED_CODES.includes(code)) return { kind: "refused", code }
    if (code !== undefined && code.endsWith("NOT_FOUND")) return { kind: "not-found" }
    return { kind: "invalid", ...(code === undefined ? {} : { code }), ...(details === undefined ? {} : { details }) }
}

/** The JSON body of a response; a body that is not JSON reads as `null`. */
const readBody = async (response: Response): Promise<unknown> => {
    try {
        return (await response.json()) as unknown
    } catch {
        return null
    }
}

/** The status of a response as an Outcome kind: 401 and 403 are `refused`, nothing collapses into `null`. */
const toOutcome = async (response: Response): Promise<Outcome<unknown>> => {
    const body = await readBody(response)
    if (response.status === 401 || response.status === 403) {
        const { code } = refusalOf(body)
        return { kind: "refused", ...(code === undefined ? {} : { code }) }
    }
    if (response.status === 404) return { kind: "not-found" }
    if (response.status === 400 || response.status === 409 || response.status === 422) return refusalOutcome(body)
    return response.ok && body !== null ? { kind: "ok", data: body } : { kind: "unavailable" }
}

/**
 * The repository's one fetch. It always carries a timeout signal, never throws and answers an Outcome.
 * The bearer stays an explicit parameter: the caller reads it and hands it in, so this module keeps no
 * shared state.
 */
export const request = async (input: ClientRequest): Promise<Outcome<unknown>> => {
    const timeout = AbortSignal.timeout(input.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    try {
        const response = await fetch(input.url, {
            method: input.method ?? "GET",
            cache: "no-store",
            headers: {
                accept: "application/json",
                ...(input.body === undefined ? {} : { "content-type": "application/json" }),
                ...(input.token ? { authorization: `Bearer ${input.token}` } : {}),
            },
            ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
            signal: input.signal === undefined ? timeout : AbortSignal.any([input.signal, timeout]),
        })
        return await toOutcome(response)
    } catch {
        return { kind: "unavailable" }
    }
}

/**
 * One GraphQL operation at `POST {baseUrl}/graphql`: the first error of the body decides the kind, else the
 * first field of `data` is the payload. Everything below the body is the one `request`.
 */
export const requestGraphql = async (input: GraphqlRequest): Promise<Outcome<unknown>> => {
    const outcome = await request({
        url: `${input.baseUrl}/graphql`,
        method: "POST",
        body: { query: input.document, variables: input.variables ?? {} },
        token: input.token,
        signal: input.signal,
    })
    if (outcome.kind !== "ok") return outcome
    const body = outcome.data
    if (!isRecord(body)) return { kind: "unavailable" }
    if (Array.isArray(body.errors) && body.errors.length > 0) return refusalOutcome(body.errors[0])
    const payload = isRecord(body.data) ? Object.values(body.data)[0] : undefined
    return payload === undefined ? { kind: "unavailable" } : { kind: "ok", data: payload }
}

/**
 * Narrow an Outcome's payload with a mapper: the mapper answers the value it could read or `null`, and
 * `null` is an `unavailable` payload, never a cast. Every other kind passes through unchanged.
 */
export const parseOutcome = <T>(outcome: Outcome<unknown>, parse: (data: unknown) => T | null): Outcome<T> => {
    if (outcome.kind !== "ok") return outcome
    const data = parse(outcome.data)
    return data === null ? { kind: "unavailable" } : { kind: "ok", data }
}

/**
 * The rows of a list payload, each read by `parseRow`; one unreadable row makes the whole payload
 * unreadable, never a silently shorter list.
 */
export const parseList = <T>(data: unknown, parseRow: (row: unknown) => T | null): ReadonlyArray<T> | null => {
    if (!Array.isArray(data)) return null
    const rows: Array<T> = []
    for (const row of data) {
        const parsed = parseRow(row)
        if (parsed === null) return null
        rows.push(parsed)
    }
    return rows
}
