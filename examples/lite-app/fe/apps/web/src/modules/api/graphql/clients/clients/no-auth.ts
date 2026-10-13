import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client"
import {
    createAttachLocaleLink,
    createErrorLink,
    createHttpLink,
    createRetryLink,
    createTimeoutLink,
    defaultOptions,
} from "../links"

/** What the anonymous client takes: the abort signal of its operations and whether the link chain logs. */
export interface CreateNoAuthApolloClientOptions {
    readonly signal?: AbortSignal
    readonly debug?: boolean
}

/**
 * The anonymous Apollo client for public operations: retry -> error -> timeout -> locale -> http. It never attaches a
 * token, so a public operation stays public even for a signed-in reader.
 */
export const createNoAuthApolloClient = ({ signal, debug = false }: CreateNoAuthApolloClientOptions = {}) =>
    new ApolloClient({
        link: ApolloLink.from([
            createRetryLink(),
            createErrorLink(debug),
            createTimeoutLink(),
            createAttachLocaleLink(),
            createHttpLink({ signal }),
        ]),
        cache: new InMemoryCache(),
        defaultOptions,
    })
