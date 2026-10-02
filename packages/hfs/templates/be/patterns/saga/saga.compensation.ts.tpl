import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { Undo@@Saga@@Command } from "../application/undo-@@saga@@.command"

@Injectable()
/** The compensation of the @@step@@ step: asks the domain to undo what the step did. */
export class @@Step@@Compensation {
    /** The step this compensation undoes. */
    readonly step = "@@step@@"

    /** The event that tells the saga to run this compensation (the contract of `@@from@@` says it compensates `@@owner@@.@@step@@`). */
    readonly event = "@@from@@.@@failed@@"

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches the one command of the compensation. */
    async run(id: string): Promise<void> {
        await this.commandBus.execute(new Undo@@Saga@@Command({ request: { id } }))
    }
}
