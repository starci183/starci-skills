import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for an occurrence that cannot be resolved. */
export interface RecurOccurrenceNotFoundExceptionMetadata extends DomainErrorMetadata {
  /** The occurrence id looked up. */
  occurrenceId?: string;
}

/** House refusal carrying code RECUR_OCCURRENCE_NOT_FOUND_EXCEPTION; every throw site attaches a metadata object naming the concrete ids the recur occurrence not found refusal turned on. */
export class RecurOccurrenceNotFoundException extends DomainError {
    constructor({ occurrenceId, ...metadata }: RecurOccurrenceNotFoundExceptionMetadata = {
    }) {
        super("RECUR_OCCURRENCE_NOT_FOUND_EXCEPTION",
            "The occurrence does not exist.",
            {
                metadata: {
                    occurrenceId, ...metadata 
                } 
            })
    }
}
