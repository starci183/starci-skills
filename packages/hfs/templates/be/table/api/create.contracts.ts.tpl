/** What create-{{singular}} takes: nothing beyond the caller, who owns the new row. */
export type Create{{Singular}}Request = Record<never, never>

/** What create-{{singular}} answers. */
export interface Create{{Singular}}Result {
    /** The id of the new {{singular}} row. */
    readonly id: string
}
