import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Type alias naming the invalid credentials exception metadata set invalid-credentials switches on; a new member is added here once, not scattered as literals. */
export type InvalidCredentialsExceptionMetadata = AbstractExceptionMetadata;

/**
 * br.login.password.sign-in requires that a refusal never names which half of the pair was wrong.
 * Every refusal path - a malformed email caught before Keycloak is asked, or Keycloak's own
 * invalid_grant - throws this exact exception, with the same message and the same code, so a transport
 * mapper cannot leak the difference even by accident.
 */
export class InvalidCredentialsException extends AbstractException {
    constructor(metadata: InvalidCredentialsExceptionMetadata = {
    }) {
        super("The email or password is incorrect.",
            "INVALID_CREDENTIALS_EXCEPTION",
            metadata)
    }
}
