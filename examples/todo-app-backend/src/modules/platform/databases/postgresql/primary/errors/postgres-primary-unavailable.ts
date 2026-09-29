import {
    AbstractException,
} from "@modules/platform/errors/index"
import type {
    AbstractExceptionMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a failed reach to the primary Postgres connection. */
export interface PostgresPrimaryUnavailableExceptionMetadata extends AbstractExceptionMetadata {
  /** The underlying failure or unexpected result, stringified. */
  reason?: string;
}

/** House refusal carrying code POSTGRES_PRIMARY_UNAVAILABLE_EXCEPTION; every throw site attaches a metadata object naming the concrete ids the postgres primary unavailable refusal turned on. */
export class PostgresPrimaryUnavailableException extends AbstractException {
    constructor({ reason, ...metadata }: PostgresPrimaryUnavailableExceptionMetadata) {
        super("The database could not be reached.",
            "POSTGRES_PRIMARY_UNAVAILABLE_EXCEPTION",
            {
                reason, ...metadata 
            })
    }
}
