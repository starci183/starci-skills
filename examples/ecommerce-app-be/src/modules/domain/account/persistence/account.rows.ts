/** The row INSERT_PERSON_IF_NEW answers. */
export interface PersonIdRow {
    /** The new person id. */
    id: string
}

/** The person id of an insert answer, or null when the email was already registered (no row). */
export const toPersonId = (rows: ReadonlyArray<PersonIdRow>): string | null => rows[0]?.id ?? null
