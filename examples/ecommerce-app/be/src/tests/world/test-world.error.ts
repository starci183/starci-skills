import { DomainError } from "@modules/platform/errors"

/** Codes of the repository side of the test world: what its declaration can refuse. */
export enum TestWorldErrorCode {
    /** The declaration needs an app the spec did not boot. */
    NotDeclared = "TEST_WORLD_NOT_DECLARED",
    /** A public door of the identity app refused to register or sign in a person the world just made up. */
    SignInRefused = "TEST_WORLD_SIGN_IN_REFUSED",
}

/** The one error class of the repository side of the test world; `params.detail` carries what a person needs to debug the run. */
export class TestWorldError extends DomainError<TestWorldErrorCode> {}
