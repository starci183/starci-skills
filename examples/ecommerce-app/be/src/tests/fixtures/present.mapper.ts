import { strict as assert } from "node:assert"

/** The value when present; a spec reads an optional answer through it instead of asserting non-null. */
export const present = <TValue>(value: TValue | null | undefined, what: string): TValue => {
    assert(value !== null && value !== undefined, `${what} is absent`)
    return value
}
