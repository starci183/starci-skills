import { Injectable } from "@nestjs/common"

@Injectable()
/** The first step of the @@saga@@ saga: the domain does its work in the transaction that starts the run and announces `@@owner@@.@@step@@`. */
export class @@Step@@Step {
    /** The name the compensation of this step carries. */
    readonly name = "@@step@@"

    /** The event this step puts on the wire (the contract `be/contracts/<service>/events.json`). */
    readonly event = "@@owner@@.@@step@@"
}
