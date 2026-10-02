// Imports the host resolves:
//   import { Command, CommandRunner } from "nest-commander"
//   import { InjectCommandBus } from "@modules/platform/cqrs"
//   import type { CommandBus } from "@modules/platform/cqrs"
//   import { RequeueDeadLetterCommand } from "../../application/requeue-dead-letter.command"

@Command({ name: "requeue-dead-letter", description: "Puts one dead-lettered event back on the bus" })
/** The shell door of one operation: no decision here, the handler and the event bus do the work. */
export class RequeueDeadLetterCli extends CommandRunner {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {
        super()
    }

    /** Maps the argument to a request and dispatches one command. */
    async run(passedParams: Array<string>): Promise<void> {
        const [deadLetterId] = passedParams
        const outcome = await this.commandBus.execute(new RequeueDeadLetterCommand({ request: { deadLetterId: deadLetterId ?? "" } }))
        process.stdout.write(JSON.stringify(outcome) + "\n")
    }
}
