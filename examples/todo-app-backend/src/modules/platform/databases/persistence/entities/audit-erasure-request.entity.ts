import {
    Column, Entity, PrimaryColumn 
} from "typeorm"

/**
 * data.audit.erasure-request: `requestId` is the opaque id every log line about this erasure names
 * instead of the person. `personId` is held only in this row, which is why it is nullable - the
 * invariant ("personId is dropped from this record once state reaches complete") is enforced by
 * AuditErasureService.tComplete setting it to null in the same write that flips `state`, so this table
 * never becomes a second permanent place a person's identity lingers past a completed erasure.
 */
@Entity({
    name: "audit_erasure_requests" 
})
/** TypeORM entity mapped to the audit erasure request row on the primary database; services reach it through the entity manager, not a repository. */
export class AuditErasureRequestEntity {
  @PrimaryColumn("text",
      {
          name: "request_id" 
      })
      requestId!: string

  @Column("text",
      {
          name: "person_id", nullable: true 
      })
      personId!: string | null

  @Column("text")
      state!: string

  @Column("timestamptz",
      {
          name: "requested_at" 
      })
      requestedAt!: Date

  @Column("timestamptz",
      {
          name: "verified_at", nullable: true 
      })
      verifiedAt!: Date | null

  @Column("timestamptz",
      {
          name: "refused_at", nullable: true 
      })
      refusedAt!: Date | null

  @Column("timestamptz",
      {
          name: "executing_at", nullable: true 
      })
      executingAt!: Date | null

  @Column("timestamptz",
      {
          name: "completed_at", nullable: true 
      })
      completedAt!: Date | null
}
