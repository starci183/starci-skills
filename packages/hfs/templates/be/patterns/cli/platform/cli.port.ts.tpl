import type { CliCommand } from "./cli.contracts"

/** Where a cli module registers its command; the app runs them once every module has registered. */
export interface CliRegistry {
    /** Registers the command under its name; a second command with the same name replaces the first. */
    add(command: CliCommand): void
}

/** The runner an app of kind cli calls from its entry with the process arguments. */
export interface CliRunner {
    /** Runs the command named by the first argument and answers its exit code; an unknown or missing name answers 2. */
    run(argv: ReadonlyArray<string>): Promise<number>
}
