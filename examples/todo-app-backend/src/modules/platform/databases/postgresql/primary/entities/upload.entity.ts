import {
    Column, Entity, PrimaryColumn 
} from "typeorm"

/**
 * data.upload.upload: owner is bound at intent creation and never rewritten; taskId is null until the
 * attach step points the record at an owned task; status is "pending" until content actually lands in
 * storage (the presigned PUT completing), then "ready" forever - a deleted row is gone, not a status.
 * This is the TypeORM shape of that row, owned by the platform database module; the object bytes
 * themselves live behind integration.upload.local's storage adapter, never in this row.
 */
@Entity({
    name: "uploads" 
})
/** TypeORM entity mapped to the upload metadata row on the primary database; services reach it through the entity manager, not a repository. */
export class UploadEntity {
  @PrimaryColumn("text")
      id!: string

  @Column("text")
      owner!: string

  @Column("text",
      {
          name: "task_id", nullable: true 
      })
      taskId!: string | null

  @Column("text")
      filename!: string

  @Column("text")
      mime!: string

  @Column("integer",
      {
          name: "size_bytes" 
      })
      sizeBytes!: number

  @Column("text",
      {
          name: "storage_key" 
      })
      storageKey!: string

  @Column("text")
      status!: string

  @Column("timestamptz",
      {
          name: "created_at" 
      })
      createdAt!: Date
}
