import type { Note } from "../note.contracts"

/** The row INSERT_NOTE answers. */
export interface NoteRow {
    /** The note id. */
    id: string
    /** The text of the note. */
    body: string
    /** When the note was written. */
    created_at: Date
}

/** The note of the row an insert answers, or null when it answered none. */
export const toNote = (rows: ReadonlyArray<NoteRow>): Note | null => {
    const row = rows[0]
    return row ? { id: row.id, body: row.body, createdAt: row.created_at.toISOString() } : null
}
