import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a Keycloak round-trip that could not be completed. */
export interface KeycloakUnavailableExceptionMetadata extends DomainErrorMetadata {
  /** The underlying transport failure, stringified. */
  detail?: string;
}

/** House refusal carrying code KEYCLOAK_UNAVAILABLE_EXCEPTION; every throw site attaches a metadata object naming the concrete ids the keycloak unavailable refusal turned on. */
export class KeycloakUnavailableException extends DomainError {
    constructor({ detail, ...metadata }: KeycloakUnavailableExceptionMetadata) {
        super("KEYCLOAK_UNAVAILABLE_EXCEPTION",
            "Keycloak could not be reached.",
            {
                metadata: {
                    detail, ...metadata 
                } 
            })
    }
}
