import { worldClock } from "./world-clock"

/** The `extensions` a door's formatError stamped on one GraphQL error: `code` carries the full code, the refusal metadata sits beside it. */
export type GraphqlExtensionsObserved = Readonly<Record<string, unknown>>

/** One GraphQL error as the spec observes it. */
export interface GraphqlErrorObserved {
    readonly message?: string
    readonly extensions?: GraphqlExtensionsObserved
}

/** The GraphQL-over-HTTP body as the wire carries it. */
export interface GraphqlWire<TData> {
    readonly data?: TData | null
    readonly errors?: ReadonlyArray<GraphqlErrorObserved> | null
}

/**
 * What one GraphQL call came back with: the parsed data (or the refusal's error code and message off
 * errors[0].extensions.code) alongside the transport facts - status, raw envelope, wall time - so a spec can assert on the
 * business outcome without losing the wire's own evidence. Refusals resolve rather than reject: a GraphQL error is data.
 */
export interface GraphqlObserved<TData> {
    readonly httpStatus: number
    readonly data: TData | null
    readonly errors: ReadonlyArray<GraphqlErrorObserved> | null
    readonly errorCode: string | null
    readonly errorMessage: string | null
    readonly raw: unknown
    readonly durationMs: number
}

const UNPARSABLE_LIMIT = 2000

/**
 * Folds one GraphQL-over-HTTP response into the observed envelope: the HTTP status stays visible beside the parsed
 * data/errors, and a body that is not an object degrades into an `unparsableBody` note instead of failing the fold.
 */
export function graphqlEnvelopeOf<TData>(
    httpStatus: number,
    body: GraphqlWire<TData> | string,
    startedAt: number,
): GraphqlObserved<TData> {
    const durationMs = worldClock.now().getTime() - startedAt
    if (typeof body === "string") {
        return {
            httpStatus,
            data: null,
            errors: null,
            errorCode: null,
            errorMessage: null,
            raw: { unparsableBody: body.slice(0, UNPARSABLE_LIMIT) },
            durationMs,
        }
    }
    const errors = body.errors ?? null
    const code = errors?.[0]?.extensions?.code
    return {
        httpStatus,
        data: body.data ?? null,
        errors,
        errorCode: typeof code === "string" ? code : null,
        errorMessage: errors?.[0]?.message ?? null,
        raw: body,
        durationMs,
    }
}
