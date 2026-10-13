/** A successful operation: the value the hook hands its caller. */
export interface GraphQLSuccess<TData> {
    readonly success: true
    readonly data: TData
}

/**
 * A failed operation: the stable code the back end answered (`extensions.code`), how it travels (`extensions.kind`:
 * `unauthenticated` and `forbidden` are the refusals) and the localized message. A transport failure (network, timeout,
 * abort) is `TRANSPORT_FAILED` of kind `unavailable`.
 */
export interface GraphQLFailure {
    readonly success: false
    readonly error: string
    readonly kind: string
    readonly message: string
}

/** The one outcome every operation of modules/api/graphql answers; components and hooks never see an Apollo result. */
export type GraphQLResponse<TData> = GraphQLSuccess<TData> | GraphQLFailure

/** What one operation function takes: its request and the abort signal SWR hands the fetcher. */
export interface OperationParams<TRequest> {
    readonly request: TRequest
    readonly signal?: AbortSignal
}
