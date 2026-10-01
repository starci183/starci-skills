import { apiGraphqlUrl } from "@/modules/config"
import { DOCUMENTS, type OperationName } from "./__generated__/documents"
import type { Outcome } from "./outcome"

/** How long a request waits before it is abandoned and answered `unavailable`. */
const REQUEST_TIMEOUT_MS = 8000

/** The codes the backend uses when the caller has no session or may not do what it asked. */
const REFUSED_CODES: ReadonlySet<string> = new Set(["UNAUTHENTICATED", "UNAUTHORIZED", "FORBIDDEN"])

/** One GraphQL operation of the client: which document, with which variables, for whose session. */
export interface GraphqlRequest {
    readonly operation: OperationName
    readonly variables?: Readonly<Record<string, unknown>>
    /** The caller's session token, sent as `Authorization: Bearer <token>`; omitted for sign-in. */
    readonly token?: string | null
    /** The caller's own signal, joined with the timeout. */
    readonly signal?: AbortSignal
}

/** True for a plain JSON object; the one guard every reader narrows an `unknown` body with. */
export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The backend's stable domain code of the first error of a GraphQL body, when it sent one. */
const errorCodeOf = (errors: ReadonlyArray<unknown>): string | undefined => {
    const first = errors[0]
    if (!isRecord(first) || !isRecord(first.extensions)) return undefined
    return typeof first.extensions.code === "string" ? first.extensions.code : undefined
}

/** A GraphQL body as an Outcome: the first error decides the kind, else the first field of `data` is the payload. */
const bodyOutcome = (body: unknown): Outcome<unknown> => {
    if (!isRecord(body)) return { kind: "unavailable" }
    if (Array.isArray(body.errors) && body.errors.length > 0) {
        const code = errorCodeOf(body.errors)
        if (code !== undefined && REFUSED_CODES.has(code)) return { kind: "refused", code }
        if (code?.endsWith("NOT_FOUND")) return { kind: "not-found" }
        return { kind: "invalid", code }
    }
    const payload = isRecord(body.data) ? Object.values(body.data)[0] : undefined
    return payload === undefined ? { kind: "unavailable" } : { kind: "ok", data: payload }
}

/** The JSON body of a successful response; a body that is not JSON is `unavailable`. */
const readBody = async (response: Response): Promise<Outcome<unknown>> => {
    try {
        return bodyOutcome((await response.json()) as unknown)
    } catch {
        return { kind: "unavailable" }
    }
}

/** The status of a response as an Outcome kind: 401 and 403 are `refused`, nothing collapses into `null`. */
const toOutcome = (response: Response): Promise<Outcome<unknown>> | Outcome<unknown> => {
    if (response.status === 401 || response.status === 403) return { kind: "refused" }
    if (response.status === 404) return { kind: "not-found" }
    if (response.status === 400 || response.status === 422) return { kind: "invalid" }
    return response.ok ? readBody(response) : { kind: "unavailable" }
}

/**
 * The repository's one fetch. It always carries a timeout signal, never throws and answers an Outcome.
 * The session token stays an explicit parameter: the hooks read it and hand it in, so this module keeps
 * no shared state.
 */
export const request = async (input: GraphqlRequest): Promise<Outcome<unknown>> => {
    const url = apiGraphqlUrl()
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                ...(input.token ? { authorization: `Bearer ${input.token}` } : {}),
            },
            body: JSON.stringify({ query: DOCUMENTS[input.operation], variables: input.variables ?? {} }),
            signal: input.signal === undefined ? timeout : AbortSignal.any([input.signal, timeout]),
        })
        return await toOutcome(response)
    } catch {
        return { kind: "unavailable" }
    }
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

/**
 * The one place a non-ok Outcome becomes the thrown `Error` a `useSWR` / `useSWRMutation` caller
 * expects, with the backend's stable code kept on `cause`.
 */
export const unwrap = <T>(outcome: Outcome<T>): T => {
    if (outcome.kind === "ok") return outcome.data
    const code = outcome.kind === "refused" || outcome.kind === "invalid" ? outcome.code : undefined
    throw new Error(outcome.kind, code === undefined ? undefined : { cause: new Error(code) })
}
