import { DomainError } from "@modules/platform/errors"

/** Codes of the e2e harness: what can go wrong while standing the stack up, observing it or reading a value a spec expects. */
export enum E2EErrorCode {
    /** The run-owned stack could not be built, migrated, seeded or started. */
    StackFailed = "E2E_STACK_FAILED",
    /** A docker call failed. */
    DockerFailed = "E2E_DOCKER_FAILED",
    /** A value a spec expects to be present is absent. */
    ValueMissing = "E2E_VALUE_MISSING",
}

/** The one error class of the e2e harness; `params.detail` carries what a person needs to debug the run. */
export class E2EError extends DomainError<E2EErrorCode> {}

/** The value of `value` when present; a spec reads an optional answer through it instead of asserting non-null. */
export const present = <T>(value: T | null | undefined, what: string): T => {
    if (value === null || value === undefined) throw new E2EError({ code: E2EErrorCode.ValueMissing, params: { detail: what } })
    return value
}
