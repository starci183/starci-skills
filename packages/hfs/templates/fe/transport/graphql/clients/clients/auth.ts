import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client"
import { authClient } from "@/modules/auth"
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

/** What the authenticated client takes: the abort signal of its operations and where the error link reports (none: it stays silent). */
export interface CreateAuthApolloClientOptions {
    readonly signal?: AbortSignal
    readonly report?: ErrorReporter
}

/**
 * The authenticated Apollo client. The link chain runs outer to inner:
 * retry (transient network failures) -> error (report) -> timeout -> refresh (one token refresh and replay on
 * UNAUTHENTICATED) -> locale (`Accept-Language`) -> access token (`Authorization: Bearer`, from modules/auth) -> http (terminal).
 */
export const createAuthApolloClient = ({ signal, report }: CreateAuthApolloClientOptions = {}) =>
    new ApolloClient({
        link: ApolloLink.from([
            createRetryLink(),
            createErrorLink(report),
            createTimeoutLink(),
            createRefreshTokenLink(() => authClient.refreshAccessToken()),
            createAttachLocaleLink(),
            createAttachAccessTokenLink(() => authClient.accessToken()),
            createHttpLink({ signal }),
        ]),
        cache: new InMemoryCache(),
        defaultOptions,
    })
