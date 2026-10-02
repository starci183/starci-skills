import { NoteEntity } from "./entities/note.entity"
import { InitNote1790000000000 } from "./migrations/1790000000000-init-note"

/** The entities of the note capability, for the connection that holds them. */
export const noteEntities = [NoteEntity]

/** The migrations of the note capability, in the order they run. */
export const noteMigrations = [InitNote1790000000000]
