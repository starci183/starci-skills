import {
    HttpStatus 
} from "@nestjs/common"
import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for a Redis answer outside the protocol; `message` carries the unexpected reply. */
export interface RedisUnexpectedReplyExceptionMetadata extends AbstractExceptionMetadata {
  /** The reply Redis returned where PONG was owed. */
  message: string;
}

/**
 * House failure carrying code REDIS_UNEXPECTED_REPLY_EXCEPTION: Redis answered a ping with
 * something other than PONG - a server that answers off-protocol is not the session store this
 * client was built against.
 */
export class RedisUnexpectedReplyException extends AbstractException {
    constructor({ message, ...metadata }: RedisUnexpectedReplyExceptionMetadata) {
        super(message,
            "REDIS_UNEXPECTED_REPLY_EXCEPTION",
            metadata,
            HttpStatus.INTERNAL_SERVER_ERROR)
    }
}
