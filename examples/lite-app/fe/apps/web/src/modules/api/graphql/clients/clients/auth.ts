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

/** What the authenticated client takes: the abort signal of its operations and whether the link chain logs. */
export interface CreateAuthApolloClientOptions {
    readonly signal?: AbortSignal
    readonly debug?: boolean
}

/**
 * The authenticated Apollo client. The link chain runs outer to inner:
 * retry (transient network failures) -> error (debug report) -> timeout -> refresh (one token refresh and replay on
 * UNAUTHENTICATED) -> locale (`x-locale`) -> access token (`Authorization: Bearer`, from modules/auth) -> http (terminal).
 */
export const createAuthApolloClient = ({ signal, debug = false }: CreateAuthApolloClientOptions = {}) =>
    new ApolloClient({
        link: ApolloLink.from([
            createRetryLink(),
            createErrorLink(debug),
            createTimeoutLink(),
            createRefreshTokenLink(() => authClient.refreshAccessToken()),
            createAttachLocaleLink(),
            createAttachAccessTokenLink(() => authClient.accessToken()),
            createHttpLink({ signal }),
        ]),
        cache: new InMemoryCache(),
        defaultOptions,
    })
