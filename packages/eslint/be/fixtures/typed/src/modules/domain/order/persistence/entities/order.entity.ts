import { Entity } from "typeorm"

/** A persisted order. */
@Entity("orders")
export class OrderEntity {
    /** The primary key. */
    id!: string
}
