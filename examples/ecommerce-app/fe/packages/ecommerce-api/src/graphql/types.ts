/** A successful operation: the value the hook hands its caller. */
export interface GraphQLSuccess<TData> {
    readonly success: true
    readonly data: TData
}

/**
 * A failed operation: the stable code the back end answered (`extensions.code`), how it travels (`extensions.kind`:
 * `unauthenticated` and `forbidden` are the refusals), the parameters of a named business refusal (`extensions.params`:
 * the product it is about, how much was asked, how much was there) and the message the back end localized from the
 * request's `Accept-Language`. A transport failure (network, timeout, abort) is `TRANSPORT_FAILED` of kind `unavailable`.
 */
export interface GraphQLFailure {
    readonly success: false
    readonly error: string
    readonly kind: string
    readonly params: Readonly<Record<string, string | number>>
    readonly message: string
}

/** The one outcome every operation answers; components and hooks never see an Apollo result. */
export type GraphQLResponse<TData> = GraphQLSuccess<TData> | GraphQLFailure

/** What one operation function takes: its request and the abort signal SWR hands the fetcher. */
export interface OperationParams<TRequest> {
    readonly request: TRequest
    readonly signal?: AbortSignal
}

/**
 * The access token source the authenticated client reads (the app's modules/auth): the token of the current session, and
 * one forced renewal for the UNAUTHENTICATED replay that answers undefined when the session has ended.
 */
export interface AccessTokenSource {
    accessToken(): Promise<string | undefined>
    refreshAccessToken(): Promise<string | undefined>
}
