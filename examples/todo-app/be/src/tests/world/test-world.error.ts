import { DomainError } from "@modules/platform/errors"

/** Codes of the repository side of the test world: what its declaration and its spec helpers can refuse. */
export enum TestWorldErrorCode {
    /** The declaration asked for an app or a fake value the world does not provide. */
    NotDeclared = "TEST_WORLD_NOT_DECLARED",
    /** The public sign-in door refused a person the world expected to be known to the identity provider. */
    SignInRefused = "TEST_WORLD_SIGN_IN_REFUSED",
    /** The app answered a webhook delivery with a body that is not JSON. */
    PayloadInvalid = "TEST_WORLD_PAYLOAD_INVALID",
}

/** The one error class of the repository side of the test world; `params.detail` carries what a person needs to debug the run. */
export class TestWorldError extends DomainError<TestWorldErrorCode> {}
