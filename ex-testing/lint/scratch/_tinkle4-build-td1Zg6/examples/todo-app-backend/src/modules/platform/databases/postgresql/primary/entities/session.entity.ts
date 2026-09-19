import {
    Column, Entity, PrimaryColumn 
} from "typeorm"

/**
 * sds.login.session-store: one row per live session. This is the TypeORM shape of that row; the platform
 * database module owns it so no feature or domain module needs to know a session lives in Postgres.
 */
@Entity({
    name: "sessions" 
})
/** TypeORM entity mapped to the session row on the primary database; services reach it through the entity manager, not a repository. */
export class SessionEntity {
  @PrimaryColumn("text")
      token!: string

  @Column("text",
      {
          name: "person_id" 
      })
      personId!: string

  @Column("timestamptz",
      {
          name: "issued_at" 
      })
      issuedAt!: Date

  @Column("timestamptz",
      {
          name: "expires_at" 
      })
      expiresAt!: Date
}
