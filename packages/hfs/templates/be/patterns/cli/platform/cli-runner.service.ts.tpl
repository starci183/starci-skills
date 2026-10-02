import { Injectable } from "@nestjs/common"
import type { CliCommand } from "./cli.contracts"
import type { CliRegistry, CliRunner } from "./cli.port"

/** The exit code of an unknown or missing command name. */
const USAGE_EXIT_CODE = 2

@Injectable()
/** Keeps the registered commands and runs the one an operator names: the whole routing of the cli kind, with no framework beyond Nest. */
export class CliRunnerService implements CliRegistry, CliRunner {
    private readonly commands = new Map<string, CliCommand>()

    /** Registers the command under its name. */
    add(command: CliCommand): void {
        this.commands.set(command.name, command)
    }

    /** Runs the command named by the first argument with the rest, and answers its exit code. */
    run(argv: ReadonlyArray<string>): Promise<number> {
        const [name, ...args] = argv
        const command = name === undefined ? undefined : this.commands.get(name)
        return command === undefined ? Promise.resolve(USAGE_EXIT_CODE) : command.run(args)
    }
}
