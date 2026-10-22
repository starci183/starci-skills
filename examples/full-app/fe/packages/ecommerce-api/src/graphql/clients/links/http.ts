import { HttpLink } from "@apollo/client"

/** What the terminal link takes: the service's GraphQL endpoint, whether cookies travel and the abort signal of every operation. */
export interface CreateHttpLinkParams {
    readonly uri: string
    readonly withCredentials?: boolean
    readonly signal: AbortSignal | undefined
}

/** The terminal link: POSTs the operation to the GraphQL endpoint of the back-end service the app names. */
export const createHttpLink = ({ uri, withCredentials = false, signal }: CreateHttpLinkParams) =>
    new HttpLink({
        uri,
        credentials: withCredentials ? "include" : "same-origin",
        fetchOptions: signal === undefined ? {} : { signal },
    })
