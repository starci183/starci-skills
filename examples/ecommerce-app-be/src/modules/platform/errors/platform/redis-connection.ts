import {
    DomainError 
} from "../domain-error"
import type {
    DomainErrorMetadata 
} from "../domain-error"

/** Metadata for a Redis connection that cannot serve; `message` carries the observed status. */
export interface RedisConnectionExceptionMetadata extends DomainErrorMetadata {
  /** Which way the connection failed - closed outright, or never became ready in time. */
  message: string;
}

/**
 * House failure carrying code REDIS_CONNECTION_EXCEPTION: the Redis connection is ended/closed,
 * or did not become ready inside its deadline - the honest boundary failure /health reports as a
 * refused dependency.
 */
export class RedisConnectionException extends DomainError {
    constructor({ message, ...metadata }: RedisConnectionExceptionMetadata) {
        super("REDIS_CONNECTION_EXCEPTION",
            message,
            {
                metadata: metadata 
            })
    }
}
