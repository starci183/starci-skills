import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client"
import {
    createAttachLocaleLink,
    createErrorLink,
    createHttpLink,
    createRetryLink,
    createTimeoutLink,
    defaultOptions,
} from "../links"
import type { ErrorReporter } from "../links/error"

/** What the anonymous client takes: the service's GraphQL endpoint, the abort signal and the error reporter. */
export interface CreateNoAuthApolloClientOptions {
    readonly uri: string
    readonly signal?: AbortSignal
    readonly report?: ErrorReporter
}

/**
 * The anonymous Apollo client of one back-end service for its public operations: retry -> error -> timeout -> locale ->
 * http. It never attaches a token, so a public operation stays public even for a signed-in reader.
 */
export const createNoAuthApolloClient = ({ uri, signal, report }: CreateNoAuthApolloClientOptions) =>
    new ApolloClient({
        link: ApolloLink.from([
            createRetryLink(),
            createErrorLink(report),
            createTimeoutLink(),
            createAttachLocaleLink(),
            createHttpLink({ uri, signal }),
        ]),
        cache: new InMemoryCache(),
        defaultOptions,
    })
