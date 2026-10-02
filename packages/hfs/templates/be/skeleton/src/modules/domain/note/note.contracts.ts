import type { EntityManager } from "typeorm"

/** One note as the doors answer it. */
export interface Note {
    /** The note id. */
    readonly id: string
    /** The text of the note. */
    readonly body: string
    /** When the note was written, as an ISO 8601 instant. */
    readonly createdAt: string
}

/** What writing a note needs; the write joins the caller transaction. */
export interface CreateNoteParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The text of the note. */
    readonly body: string
}
