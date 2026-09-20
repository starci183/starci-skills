import {
    AsyncLocalStorage 
} from "node:async_hooks"

/**
 * The correlation context for one in-flight request: the id that arrived on `x-request-id` or that
 * the middleware minted, stored on AsyncLocalStorage so anything downstream of the middleware -
 * resolvers, services, the WinstonService line itself - can read the same request id without it
 * being threaded through signatures. The id also travels back out on the response's
 * `x-request-id` header, so a client can quote it when reporting a failure.
 */
export const REQUEST_ID_HEADER = "x-request-id"

/** What one in-flight request carries on AsyncLocalStorage - today only the correlation id; the
 * shape exists so a second request-scoped field never has to invent a second storage. */
export interface RequestContext {
  readonly requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>()

/** Runs `next` inside a context carrying `requestId`; only ObservabilityMiddleware calls this. */
export const runWithRequestContext = (context: RequestContext, next: () => void): void => {
    storage.run(context,
        next)
}

/** The in-flight request's correlation id, or undefined outside a request (ticks, boot). */
export const currentRequestId = (): string | undefined => storage.getStore()?.requestId
