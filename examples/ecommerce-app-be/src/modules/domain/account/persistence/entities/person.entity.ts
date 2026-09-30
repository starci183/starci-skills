import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity("persons")
/** A registered person: the email is unique, the password hash never leaves the identity service. */
export class PersonEntity {
    /** The person id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The sign-in email, unique. */
    @Column({ name: "email", type: "text", unique: true })
    email!: string

    /** The scrypt hex of the password. */
    @Column({ name: "password_hash", type: "text" })
    passwordHash!: string

    /** When the person registered. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
