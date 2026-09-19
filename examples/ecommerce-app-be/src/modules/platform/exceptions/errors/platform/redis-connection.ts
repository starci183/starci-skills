import {
    HttpStatus 
} from "@nestjs/common"
import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for a Redis connection that cannot serve; `message` carries the observed status. */
export interface RedisConnectionExceptionMetadata extends AbstractExceptionMetadata {
  /** Which way the connection failed - closed outright, or never became ready in time. */
  message: string;
}

/**
 * House failure carrying code REDIS_CONNECTION_EXCEPTION: the Redis connection is ended/closed,
 * or did not become ready inside its deadline - the honest boundary failure /health reports as a
 * refused dependency.
 */
export class RedisConnectionException extends AbstractException {
    constructor({ message, ...metadata }: RedisConnectionExceptionMetadata) {
        super(message,
            "REDIS_CONNECTION_EXCEPTION",
            metadata,
            HttpStatus.INTERNAL_SERVER_ERROR)
    }
}
