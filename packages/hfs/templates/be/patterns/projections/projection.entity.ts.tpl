import { Entity, PrimaryColumn } from "typeorm"

@Entity("@@nameSnake@@")
/** The read-model row of one @@name@@: written only by its projection. */
export class @@Name@@ProjectionEntity {
    /** The id of the aggregate the row summarises. */
    @PrimaryColumn({ name: "id", type: "uuid" })
    id!: string
}
