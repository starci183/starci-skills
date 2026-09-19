import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for a RESP frame the notify queue client could not parse. */
export interface NotifyQueueProtocolExceptionMetadata extends AbstractExceptionMetadata {
  /** The unrecognised RESP type byte that tripped the parser. */
  typeByte?: string;
}

/**
 * integration.notify.queue: a RESP reply carried a type byte outside the closed set the parser
 * knows - the connection is speaking a protocol this client does not implement, so the read fails
 * rather than guessing at a frame boundary.
 */
export class NotifyQueueProtocolException extends AbstractException {
    constructor({ typeByte, ...metadata }: NotifyQueueProtocolExceptionMetadata) {
        super(`unknown RESP type byte: ${typeByte ?? "?"}`,
            "NOTIFY_QUEUE_PROTOCOL_EXCEPTION",
            {
                typeByte, ...metadata 
            })
    }
}
