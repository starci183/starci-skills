import {
    Column, Entity, PrimaryColumn 
} from "typeorm"

/**
 * br.notify.digest.window / decision.notify.digest-window's "one rolling window per person per channel":
 * not itself a declared `data.notify.*` record - it is this module's own bookkeeping for which open
 * window a newly admitted notification joins, and when that window's content is read (at `closesAt`,
 * never at `opensAt`). One row is the window from the first admitted event until it is flushed;
 * `flushedAt` is set exactly once, by the flush that reads its content.
 */
@Entity({
    name: "notify_digest_windows" 
})
/** TypeORM entity mapped to the notify digest window row on the primary database; services reach it through the entity manager, not a repository. */
export class NotifyDigestWindowEntity {
  @PrimaryColumn("text")
      id!: string

  @Column("text",
      {
          name: "person_id" 
      })
      personId!: string

  @Column("text")
      channel!: string

  @Column("timestamptz",
      {
          name: "opens_at" 
      })
      opensAt!: Date

  @Column("timestamptz",
      {
          name: "closes_at" 
      })
      closesAt!: Date

  @Column("timestamptz",
      {
          name: "flushed_at", nullable: true 
      })
      flushedAt!: Date | null
}
