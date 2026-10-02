import { Entity } from "typeorm"

@Entity("jobs")
/** The job row: its fencing token is bumped by the claim only. */
export class JobEntity {
    id!: string
    fencingToken!: number
    status!: string
}
