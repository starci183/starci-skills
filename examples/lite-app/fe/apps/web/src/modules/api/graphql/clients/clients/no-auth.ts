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

/** What the anonymous client takes: the abort signal of its operations and where the error link reports (none: it stays silent). */
export interface CreateNoAuthApolloClientOptions {
    readonly signal?: AbortSignal
    readonly report?: ErrorReporter
}

/**
 * The anonymous Apollo client for public operations: retry -> error -> timeout -> locale -> http. It never attaches a
 * token, so a public operation stays public even for a signed-in reader.
 */
export const createNoAuthApolloClient = ({ signal, report }: CreateNoAuthApolloClientOptions = {}) =>
    new ApolloClient({
        link: ApolloLink.from([
            createRetryLink(),
            createErrorLink(report),
            createTimeoutLink(),
            createAttachLocaleLink(),
            createHttpLink({ signal }),
        ]),
        cache: new InMemoryCache(),
        defaultOptions,
    })
