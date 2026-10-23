import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client"
import type { AccessTokenSource } from "../../types"
import {
    createAttachAccessTokenLink,
    createAttachLocaleLink,
    createErrorLink,
    createHttpLink,
    createRefreshTokenLink,
    createRetryLink,
    createTimeoutLink,
    defaultOptions,
} from "../links"
import type { ErrorReporter } from "../links/error"

/** What the authenticated client takes: the service's GraphQL endpoint, the app's token source, the abort signal and the error reporter. */
export interface CreateAuthApolloClientOptions {
    readonly uri: string
    readonly auth: AccessTokenSource
    readonly signal: AbortSignal | undefined
    readonly report?: ErrorReporter
}

/**
 * The authenticated Apollo client of one back-end service. The link chain runs outer to inner:
 * retry (transient network failures) -> error (report) -> timeout -> refresh (one token renewal and replay on
 * UNAUTHENTICATED) -> locale (`Accept-Language`) -> access token (`Authorization: Bearer`) -> http (terminal).
 */
export const createAuthApolloClient = ({ uri, auth, signal, report }: CreateAuthApolloClientOptions) =>
    new ApolloClient({
        link: ApolloLink.from([
            createRetryLink(),
            createErrorLink(report),
            createTimeoutLink(),
            createRefreshTokenLink(() => auth.refreshAccessToken()),
            createAttachLocaleLink(),
            createAttachAccessTokenLink(() => auth.accessToken()),
            createHttpLink({ uri, signal }),
        ]),
        cache: new InMemoryCache(),
        defaultOptions,
    })
