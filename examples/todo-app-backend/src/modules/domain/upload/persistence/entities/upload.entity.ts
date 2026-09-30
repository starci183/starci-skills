import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity("uploads")
/**
 * One row of upload metadata: the owner is bound at intake and never rewritten; taskId is null until the upload is
 * attached to a task; status is pending until the bytes land, then ready. The bytes live behind the storage integration.
 */
export class UploadEntity {
    /** The upload id. */
    @PrimaryColumn({ name: "id", type: "text" })
    id!: string

    /** The person who owns the upload. */
    @Column({ name: "owner", type: "text" })
    owner!: string

    /** The task the upload is attached to, null while it is unattached. */
    @Column({ name: "task_id", type: "text", nullable: true })
    taskId!: string | null

    /** The file name the owner gave. */
    @Column({ name: "filename", type: "text" })
    filename!: string

    /** The declared media type. */
    @Column({ name: "mime", type: "text" })
    mime!: string

    /** The size in bytes: declared at intent, the received size once the content landed. */
    @Column({ name: "size_bytes", type: "integer" })
    sizeBytes!: number

    /** The key of the object in the storage plane. */
    @Column({ name: "storage_key", type: "text" })
    storageKey!: string

    /** The lifecycle: pending until the bytes land, then ready. */
    @Column({ name: "status", type: "text" })
    status!: string

    /** When the upload row was created. */
    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date
}
