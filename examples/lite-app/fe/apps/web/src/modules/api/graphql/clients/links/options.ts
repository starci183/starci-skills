import type { ApolloClient } from "@apollo/client"

/** How long one operation may run before the timeout link fails it. */
export const OPERATION_TIMEOUT_MS = 15_000

/** The retry window of a transient network failure: the first delay, the longest delay and the attempts in all. */
export const RETRY_POLICY = { initialDelayMs: 300, maxDelayMs: 3_000, maxAttempts: 3 } as const

/**
 * The client policies: SWR owns the cache, so Apollo never answers from its own, and a GraphQL error comes back as the
 * result's `error` (the operation maps it to a GraphQLResponse) instead of a rejected promise.
 */
export const defaultOptions: ApolloClient.DefaultOptions = {
    watchQuery: { fetchPolicy: "no-cache", errorPolicy: "all" },
    query: { fetchPolicy: "no-cache", errorPolicy: "all" },
    mutate: { errorPolicy: "all" },
}
