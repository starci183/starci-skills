import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity("notes")
/** One note: a short text and the instant it was written. */
export class NoteEntity {
    /** The note id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The text of the note. */
    @Column({ name: "body", type: "text" })
    body!: string

    /** When the note was written, from the injected clock. */
    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date
}
