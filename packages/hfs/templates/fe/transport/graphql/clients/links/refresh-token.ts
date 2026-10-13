import { CombinedGraphQLErrors, Observable } from "@apollo/client"
import { ErrorLink } from "@apollo/client/link/error"

/** The context flag of an operation already replayed after a refresh: it is never refreshed twice. */
const REFRESHED = "accessTokenRefreshed"

/** True when the back end refused the operation because the caller is not signed in (kind `unauthenticated`). */
const isUnauthenticated = (error: unknown): boolean =>
    CombinedGraphQLErrors.is(error) &&
    error.errors.some(
        (each) => each.extensions?.kind === "unauthenticated" || each.extensions?.code === "UNAUTHENTICATED",
    )

/**
 * On an UNAUTHENTICATED answer, asks modules/auth for a fresh access token once and replays the operation with it. When no
 * token comes back (the session ended) the original error travels on.
 */
export const createRefreshTokenLink = (refreshAccessToken: () => Promise<string | undefined>) =>
    new ErrorLink(({ error, operation, forward }) => {
        if (!isUnauthenticated(error) || operation.getContext()[REFRESHED] === true) return
        return new Observable((observer) => {
            let subscription: { unsubscribe: () => void } | undefined
            refreshAccessToken().then(
                (token) => {
                    if (token === undefined) {
                        observer.error(error)
                        return
                    }
                    operation.setContext({ [REFRESHED]: true })
                    subscription = forward(operation).subscribe(observer)
                },
                (cause: unknown) => observer.error(cause),
            )
            return () => subscription?.unsubscribe()
        })
    })
