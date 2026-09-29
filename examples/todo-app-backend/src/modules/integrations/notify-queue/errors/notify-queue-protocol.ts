import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a RESP frame the notify queue client could not parse. */
export interface NotifyQueueProtocolExceptionMetadata extends DomainErrorMetadata {
  /** The unrecognised RESP type byte that tripped the parser. */
  typeByte?: string;
}

/**
 * integration.notify.queue: a RESP reply carried a type byte outside the closed set the parser
 * knows - the connection is speaking a protocol this client does not implement, so the read fails
 * rather than guessing at a frame boundary.
 */
export class NotifyQueueProtocolException extends DomainError {
    constructor({ typeByte, ...metadata }: NotifyQueueProtocolExceptionMetadata) {
        super("NOTIFY_QUEUE_PROTOCOL_EXCEPTION",
            `unknown RESP type byte: ${typeByte ?? "?"}`,
            {
                metadata: {
                    typeByte, ...metadata 
                } 
            })
    }
}
