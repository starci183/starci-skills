import {
    HttpStatus 
} from "@nestjs/common"
import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for a metadata.json that exists but is not readable JSON; `message` names the file. */
export interface MetadataUnreadableExceptionMetadata extends AbstractExceptionMetadata {
  /** The file that failed to parse. */
  message: string;
}

/**
 * House failure carrying code METADATA_UNREADABLE_EXCEPTION: the metadata.json this service found
 * is not readable JSON - the one runtime projection every port and URL resolves from cannot be
 * half-read, so the service refuses to boot.
 */
export class MetadataUnreadableException extends AbstractException {
    constructor({ message, ...metadata }: MetadataUnreadableExceptionMetadata) {
        super(message,
            "METADATA_UNREADABLE_EXCEPTION",
            metadata,
            HttpStatus.INTERNAL_SERVER_ERROR)
    }
}
