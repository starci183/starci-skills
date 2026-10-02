import { Entity } from "typeorm"

@Entity("user_xp_projection")
/** The read-model row of one user's xp. */
export class UserXpProjectionEntity {
    userId!: string
    total!: number
}
