import {
    Column, Entity, PrimaryColumn 
} from "typeorm"

/**
 * data.recur.occurrence `extends data.task.task`: the base fields (id, owner, title, complete,
 * completedAt) live on the `tasks` table itself - an occurrence's row there is written through the same
 * `CreateTaskCommand` the task capability's own create-task flow uses (see `GeneratorService`), so
 * `TaskCreationPolicyRegistry` sees every occurrence exactly like any other task. This entity is the
 * "plus your own occurrence row" half: id is the same opaque id
 * as the `tasks` row it was created alongside (a one-to-one extension, not a foreign key to a different
 * id), so a reader joins `occurrences` to `tasks` by `id` to get the full data.recur.occurrence shape.
 * `owner` is deliberately not duplicated here - it is already on the joined `tasks` row, copied from the
 * rule's owner at the moment `CreateTaskCommand` ran.
 */
@Entity({
    name: "occurrences" 
})
/** TypeORM entity mapped to the occurrence row on the primary database; services reach it through the entity manager, not a repository. */
export class OccurrenceEntity {
  @PrimaryColumn("text")
      id!: string

  @Column("text",
      {
          name: "rule_id" 
      })
      ruleId!: string

  @Column("text",
      {
          name: "window_key" 
      })
      windowKey!: string

  @Column("text",
      {
          name: "local_date" 
      })
      localDate!: string

  @Column("timestamptz",
      {
          name: "due_at_utc" 
      })
      dueAtUtc!: Date

  @Column("text")
      status!: string
}
