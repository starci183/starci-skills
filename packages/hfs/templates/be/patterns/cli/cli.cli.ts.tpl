import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import type { CliCommand } from "@modules/platform/cli"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { @@Action@@Command } from "../../application/@@action@@.command"

@Injectable()
/** The shell door of @@command@@: it maps the argument to a request and dispatches one command; the handler decides. */
export class @@Command@@Cli implements CliCommand {
    readonly name = "@@command@@"

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs the command for the id in the first argument; a missing argument is a usage error. */
    async run(args: ReadonlyArray<string>): Promise<number> {
        const [id] = args
        if (id === undefined) return 2
        await this.commandBus.execute(new @@Action@@Command({ request: { id } }))
        return 0
    }
}
