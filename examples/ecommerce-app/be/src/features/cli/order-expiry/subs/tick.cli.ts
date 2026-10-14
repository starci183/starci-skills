import { CommandRunner, SubCommand } from "nest-commander"
import { OrderExpiryTicksService } from "@modules/domain/order-expiry-ticks"

@SubCommand({ name: "tick", description: "Enqueue one pending-order expiry pass" })
/** `cli order-expiry tick`: the manual counterpart of the recurring expiry scheduler. */
export class TickCli extends CommandRunner {
    constructor(private readonly ticks: OrderExpiryTicksService) {
        super()
    }

    /** Enqueues one tick through the domain capability. */
    async run(): Promise<void> {
        await this.ticks.enqueueTick()
    }
}
