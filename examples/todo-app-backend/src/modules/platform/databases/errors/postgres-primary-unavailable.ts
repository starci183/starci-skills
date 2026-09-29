import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a failed reach to the primary Postgres connection. */
export interface PostgresPrimaryUnavailableExceptionMetadata extends DomainErrorMetadata {
  /** The underlying failure or unexpected result, stringified. */
  reason?: string;
}

/** House refusal carrying code POSTGRES_PRIMARY_UNAVAILABLE_EXCEPTION; every throw site attaches a metadata object naming the concrete ids the postgres primary unavailable refusal turned on. */
export class PostgresPrimaryUnavailableException extends DomainError {
    constructor({ reason, ...metadata }: PostgresPrimaryUnavailableExceptionMetadata) {
        super("POSTGRES_PRIMARY_UNAVAILABLE_EXCEPTION",
            "The database could not be reached.",
            {
                metadata: {
                    reason, ...metadata 
                } 
            })
    }
}
