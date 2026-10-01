import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity("audit_keys")
/**
 * The keystore row of one person. The key id is opaque, unique and the only value a log line carries. Erasure deletes
 * this row outright, which destroys the key and the person-to-key mapping together.
 */
export class AuditKeyEntity {
    /** The person the key belongs to. */
    @PrimaryColumn({ name: "person_id", type: "text" })
    personId!: string

    /** The opaque key id. */
    @Column({ name: "key_id", type: "text", unique: true })
    keyId!: string

    /** The key material, base64. */
    @Column({ name: "key", type: "text" })
    key!: string

    /** When the key was minted. */
    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date
}
