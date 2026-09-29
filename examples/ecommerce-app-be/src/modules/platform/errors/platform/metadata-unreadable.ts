import {
    DomainError 
} from "../domain-error"
import type {
    DomainErrorMetadata 
} from "../domain-error"

/** Metadata for a metadata.json that exists but is not readable JSON; `message` names the file. */
export interface MetadataUnreadableExceptionMetadata extends DomainErrorMetadata {
  /** The file that failed to parse. */
  message: string;
}

/**
 * House failure carrying code METADATA_UNREADABLE_EXCEPTION: the metadata.json this service found
 * is not readable JSON - the one runtime projection every port and URL resolves from cannot be
 * half-read, so the service refuses to boot.
 */
export class MetadataUnreadableException extends DomainError {
    constructor({ message, ...metadata }: MetadataUnreadableExceptionMetadata) {
        super("METADATA_UNREADABLE_EXCEPTION",
            message,
            {
                metadata: metadata 
            })
    }
}
