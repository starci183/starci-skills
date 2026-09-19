import {
    Column, Entity, PrimaryColumn 
} from "typeorm"

/**
 * data.task.task: owner is bound at creation and never rewritten; completedAt is set if and only if
 * complete is true. This is the TypeORM shape of that row, owned by the platform database module.
 */
@Entity({
    name: "tasks" 
})
/** TypeORM entity mapped to the task row on the primary database; services reach it through the entity manager, not a repository. */
export class TaskEntity {
  @PrimaryColumn("text")
      id!: string

  @Column("text")
      owner!: string

  @Column("text")
      title!: string

  @Column("boolean")
      complete!: boolean

  @Column("timestamptz",
      {
          name: "completed_at", nullable: true 
      })
      completedAt!: Date | null
}
