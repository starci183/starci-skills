import {
    DomainError 
} from "../domain-error"
import type {
    DomainErrorMetadata 
} from "../domain-error"

/** Metadata for a Redis answer outside the protocol; `message` carries the unexpected reply. */
export interface RedisUnexpectedReplyExceptionMetadata extends DomainErrorMetadata {
  /** The reply Redis returned where PONG was owed. */
  message: string;
}

/**
 * House failure carrying code REDIS_UNEXPECTED_REPLY_EXCEPTION: Redis answered a ping with
 * something other than PONG - a server that answers off-protocol is not the session store this
 * client was built against.
 */
export class RedisUnexpectedReplyException extends DomainError {
    constructor({ message, ...metadata }: RedisUnexpectedReplyExceptionMetadata) {
        super("REDIS_UNEXPECTED_REPLY_EXCEPTION",
            message,
            {
                metadata: metadata 
            })
    }
}
