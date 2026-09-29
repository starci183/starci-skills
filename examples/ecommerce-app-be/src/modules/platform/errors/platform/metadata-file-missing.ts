import {
    DomainError 
} from "../domain-error"
import type {
    DomainErrorMetadata 
} from "../domain-error"

/** Metadata for a metadata.json that cannot be found; `message` states where the search looked. */
export interface MetadataFileMissingExceptionMetadata extends DomainErrorMetadata {
  /** Which resolution failed - the env-pointed path that does not exist, or the upward walk. */
  message: string;
}

/**
 * House failure carrying code METADATA_FILE_MISSING_EXCEPTION: the metadata.json this service
 * reads its whole "where everything lives" view from cannot be found - the env var points at a
 * path that does not exist, or no metadata.json sits at or above the process cwd. The service
 * refuses to boot rather than inventing ports.
 */
export class MetadataFileMissingException extends DomainError {
    constructor({ message, ...metadata }: MetadataFileMissingExceptionMetadata) {
        super("METADATA_FILE_MISSING_EXCEPTION",
            message,
            {
                metadata: metadata 
            })
    }
}
