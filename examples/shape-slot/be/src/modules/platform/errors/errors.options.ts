import type { ErrorKindTable } from "./errors.contracts"

/** Options of the errors capability: the kind tables of every capability the app composes. */
export interface ErrorsOptions {
    /** One `<C>_ERROR_KINDS` table per capability; a code found in none of them is internal. */
    readonly kinds: ReadonlyArray<ErrorKindTable>
}
