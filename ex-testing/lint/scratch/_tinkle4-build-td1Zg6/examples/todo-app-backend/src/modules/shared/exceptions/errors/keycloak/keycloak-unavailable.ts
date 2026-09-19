import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for a Keycloak round-trip that could not be completed. */
export interface KeycloakUnavailableExceptionMetadata extends AbstractExceptionMetadata {
  /** The underlying transport failure, stringified. */
  detail?: string;
}

/** House refusal carrying code KEYCLOAK_UNAVAILABLE_EXCEPTION; every throw site attaches a metadata object naming the concrete ids the keycloak unavailable refusal turned on. */
export class KeycloakUnavailableException extends AbstractException {
    constructor({ detail, ...metadata }: KeycloakUnavailableExceptionMetadata) {
        super("Keycloak could not be reached.",
            "KEYCLOAK_UNAVAILABLE_EXCEPTION",
            {
                detail, ...metadata 
            })
    }
}
