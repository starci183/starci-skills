import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity("persons")
/** A shopper of the product: the identity provider's subject is the id; the credential lives in the provider, never here. */
export class PersonEntity {
    /** The Keycloak subject of the shopper. */
    @PrimaryColumn("uuid", { name: "id" })
    id!: string

    /** The sign-in email. */
    @Column({ name: "email", type: "text", unique: true })
    email!: string

    /** When the person first registered or signed in. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
