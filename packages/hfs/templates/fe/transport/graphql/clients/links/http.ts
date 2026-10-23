import { HttpLink } from "@apollo/client"
import { graphqlUrl } from "@/modules/config"

/** What the terminal link takes: whether cookies travel and the abort signal of every operation of the client. */
export interface CreateHttpLinkParams {
    readonly withCredentials?: boolean
    readonly signal: AbortSignal | undefined
}

/** The terminal link: POSTs the operation to the back end's GraphQL endpoint (modules/config). */
export const createHttpLink = ({ withCredentials = false, signal }: CreateHttpLinkParams) =>
    new HttpLink({
        uri: graphqlUrl(),
        credentials: withCredentials ? "include" : "same-origin",
        fetchOptions: signal === undefined ? {} : { signal },
    })
