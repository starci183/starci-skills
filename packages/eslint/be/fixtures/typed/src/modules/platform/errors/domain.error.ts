/** The base of every capability error family (fixture). */
export abstract class DomainError<C extends string> extends Error {
    /** The stable machine code. */
    readonly code: C

    constructor(init: { code: C; cause?: unknown }) {
        super(init.code)
        this.code = init.code
    }
}
