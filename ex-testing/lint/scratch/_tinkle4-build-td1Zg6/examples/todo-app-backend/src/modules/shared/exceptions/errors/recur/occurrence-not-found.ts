import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for an occurrence that cannot be resolved. */
export interface RecurOccurrenceNotFoundExceptionMetadata extends AbstractExceptionMetadata {
  /** The occurrence id looked up. */
  occurrenceId?: string;
}

/** House refusal carrying code RECUR_OCCURRENCE_NOT_FOUND_EXCEPTION; every throw site attaches a metadata object naming the concrete ids the recur occurrence not found refusal turned on. */
export class RecurOccurrenceNotFoundException extends AbstractException {
    constructor({ occurrenceId, ...metadata }: RecurOccurrenceNotFoundExceptionMetadata = {
    }) {
        super("The occurrence does not exist.",
            "RECUR_OCCURRENCE_NOT_FOUND_EXCEPTION",
            {
                occurrenceId, ...metadata 
            })
    }
}
