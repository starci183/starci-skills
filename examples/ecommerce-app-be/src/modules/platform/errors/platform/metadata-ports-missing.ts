import {
    HttpStatus 
} from "@nestjs/common"
import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for a metadata.json that lacks the resolved ports; `message` names file and fields. */
export interface MetadataPortsMissingExceptionMetadata extends AbstractExceptionMetadata {
  /** The file and the port fields it failed to carry. */
  message: string;
}

/**
 * House failure carrying code METADATA_PORTS_MISSING_EXCEPTION: the metadata.json this service
 * parsed does not carry the resolved ports it reads (the service's own api port, its peer's and
 * the datastore's). A projection without the numbers is not a projection - the service refuses
 * to boot rather than defaulting to literals.
 */
export class MetadataPortsMissingException extends AbstractException {
    constructor({ message, ...metadata }: MetadataPortsMissingExceptionMetadata) {
        super(message,
            "METADATA_PORTS_MISSING_EXCEPTION",
            metadata,
            HttpStatus.INTERNAL_SERVER_ERROR)
    }
}
