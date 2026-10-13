/** What create-calendar takes: nothing beyond the caller, who owns the new row. */
export type CreateCalendarRequest = Record<never, never>

/** What create-calendar answers. */
export interface CreateCalendarResult {
    /** The id of the new calendar row. */
    readonly id: string
}
