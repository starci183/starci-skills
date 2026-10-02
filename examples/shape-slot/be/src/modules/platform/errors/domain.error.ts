import type { DomainErrorInit, ErrorParams } from "./errors.contracts"

/**
 * The base of every capability error family: a stable code, text parameters and the cause. The message is the code
 * itself; display text is resolved from the message catalog by code, so an error never carries prose.
 */
export abstract class DomainError<C extends string> extends Error {
    /** The stable machine code, `<CAPABILITY>_<WHAT>`. */
    readonly code: C

    /** Values for the placeholders of the display text. */
    readonly params: ErrorParams

    constructor(init: DomainErrorInit<C>) {
        super(init.code, init.cause === undefined ? undefined : { cause: init.cause })
        this.name = new.target.name
        this.code = init.code
        this.params = init.params ?? {}
    }
}
