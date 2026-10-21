import { CombinedGraphQLErrors } from "@apollo/client"
import { RetryLink } from "@apollo/client/link/retry"
import { RETRY_POLICY } from "./options"

/**
 * Retries a transient network failure with jittered exponential backoff. A GraphQL error is an answer of the back end and
 * is never retried. First in the chain, so every other link sees the operation once per attempt.
 */
export const createRetryLink = () =>
    new RetryLink({
        delay: { initial: RETRY_POLICY.initialDelayMs, max: RETRY_POLICY.maxDelayMs, jitter: true },
        attempts: {
            max: RETRY_POLICY.maxAttempts,
            retryIf: (error) => !CombinedGraphQLErrors.is(error),
        },
    })
