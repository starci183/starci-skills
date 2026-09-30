import { DomainError } from "@modules/platform/errors"

/** Codes of the test world: what can go wrong while it stands infrastructure up, boots an app or reads its state. */
export enum TestWorldErrorCode {
    /** The shared infrastructure (docker, a database) could not be started or removed. */
    InfrastructureFailed = "TEST_WORLD_INFRASTRUCTURE_FAILED",
    /** The world state file of the run is absent or malformed: the jest globalSetup did not run. */
    StateMissing = "TEST_WORLD_STATE_MISSING",
    /** A spec asked the world for something before `beforeAll` booted it. */
    NotBooted = "TEST_WORLD_NOT_BOOTED",
    /** A spec asked for an app, a fake or a mode the world was not asked to provide. */
    NotDeclared = "TEST_WORLD_NOT_DECLARED",
    /** A public door refused a call the world expected to succeed. */
    DoorRefused = "TEST_WORLD_DOOR_REFUSED",
}

/** The one error class of the test world; `params.detail` carries what a person needs to debug the run. */
export class TestWorldError extends DomainError<TestWorldErrorCode> {}
