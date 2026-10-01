import { DomainError } from "@modules/platform/errors"

/** Codes of the test world: what can go wrong while it stands infrastructure up or boots an app. */
export enum TestWorldErrorCode {
    /** The shared infrastructure (docker, the databases, the redis) could not be started or removed. */
    InfrastructureFailed = "TEST_WORLD_INFRASTRUCTURE_FAILED",
    /** The world state file of the run is absent or malformed: the jest globalSetup did not run. */
    StateMissing = "TEST_WORLD_STATE_MISSING",
    /** A spec asked the world for something before `beforeAll` booted it. */
    NotBooted = "TEST_WORLD_NOT_BOOTED",
    /** A spec asked for an app or a mode the world was not asked to provide. */
    NotDeclared = "TEST_WORLD_NOT_DECLARED",
    /** The public sign-in door refused a person the world expected to be known to the identity provider. */
    SignInRefused = "TEST_WORLD_SIGN_IN_REFUSED",
    /** A code the public kind table of an integration is expected to carry is missing from it. */
    KindMissing = "TEST_WORLD_KIND_MISSING",
    /** A state the world waited for (a readiness probe, an asynchronous effect) did not arrive before its deadline. */
    TimedOut = "TEST_WORLD_TIMED_OUT",
}

/** The one error class of the test world; `params.detail` carries what a person needs to debug the run. */
export class TestWorldError extends DomainError<TestWorldErrorCode> {}
