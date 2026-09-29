import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Type alias naming the invalid credentials exception metadata set invalid-credentials switches on; a new member is added here once, not scattered as literals. */
export type InvalidCredentialsExceptionMetadata = DomainErrorMetadata;

/**
 * br.login.password.sign-in requires that a refusal never names which half of the pair was wrong.
 * Every refusal path - a malformed email caught before Keycloak is asked, or Keycloak's own
 * invalid_grant - throws this exact exception, with the same message and the same code, so a transport
 * mapper cannot leak the difference even by accident.
 */
export class InvalidCredentialsException extends DomainError {
    constructor(metadata: InvalidCredentialsExceptionMetadata = {
    }) {
        super("INVALID_CREDENTIALS_EXCEPTION",
            "The email or password is incorrect.",
            {
                metadata: metadata 
            })
    }
}
