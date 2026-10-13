import { CombinedGraphQLErrors } from "@apollo/client"
import type { GraphQLFailure, GraphQLResponse } from "../types"

/** The code of a failure the back end never answered: network, timeout or abort. */
const TRANSPORT_FAILED = "TRANSPORT_FAILED"

/** What an Apollo query or mutation resolves to under the `all` error policy: the data it got and the error it met. */
interface ApolloOutcome<TData> {
    readonly data?: TData | null
    readonly error?: unknown
}

const transportFailure = (message: string): GraphQLFailure => ({
    success: false,
    error: TRANSPORT_FAILED,
    kind: "unavailable",
    params: {},
    message,
})

/** The scalar parameters of a refusal (`extensions.params`); anything that is not a string or a number is left out. */
const paramsOf = (value: unknown): Readonly<Record<string, string | number>> => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
    const params: Record<string, string | number> = {}
    for (const [key, entry] of Object.entries(value)) {
        if (typeof entry === "string" || typeof entry === "number") params[key] = entry
    }
    return params
}

/** The failure of an Apollo error: the first GraphQL error's code, kind, parameters and localized message, else a transport failure. */
const failureOf = (error: unknown): GraphQLFailure => {
    if (!CombinedGraphQLErrors.is(error))
        return transportFailure(error instanceof Error ? error.message : TRANSPORT_FAILED)
    const first = error.errors[0]
    const code = first?.extensions?.code
    const kind = first?.extensions?.kind
    return {
        success: false,
        error: typeof code === "string" ? code : TRANSPORT_FAILED,
        kind: typeof kind === "string" ? kind : "internal",
        params: paramsOf(first?.extensions?.params),
        message: first?.message ?? TRANSPORT_FAILED,
    }
}

/** Maps one Apollo outcome to the GraphQLResponse of the operation, `pick` selecting the operation's field from the data. */
export const graphqlResponseOf = <TData, TValue>(
    outcome: ApolloOutcome<TData>,
    pick: (data: TData) => TValue,
): GraphQLResponse<TValue> => {
    if (outcome.error !== undefined) return failureOf(outcome.error)
    if (outcome.data === undefined || outcome.data === null) return transportFailure(TRANSPORT_FAILED)
    return { success: true, data: pick(outcome.data) }
}
