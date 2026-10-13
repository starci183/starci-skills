import { ApolloLink, Observable } from "@apollo/client"
import { OPERATION_TIMEOUT_MS } from "./options"

/** Fails the operation when no answer arrived within the timeout; the upstream links see the timeout as an error. */
export const createTimeoutLink = (timeoutMs = OPERATION_TIMEOUT_MS) =>
    new ApolloLink(
        (operation, forward) =>
            new Observable((observer) => {
                const timer = setTimeout(() => {
                    observer.error(new Error(`${operation.operationName} timed out after ${timeoutMs}ms`))
                }, timeoutMs)
                const subscription = forward(operation).subscribe({
                    next: (value) => observer.next(value),
                    error: (cause: unknown) => {
                        clearTimeout(timer)
                        observer.error(cause)
                    },
                    complete: () => {
                        clearTimeout(timer)
                        observer.complete()
                    },
                })
                return () => {
                    clearTimeout(timer)
                    subscription.unsubscribe()
                }
            }),
    )
