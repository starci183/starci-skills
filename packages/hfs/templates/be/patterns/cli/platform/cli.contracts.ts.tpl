/** One operator command: the name an operator types and the run that answers an exit code. */
export interface CliCommand {
    /** The name an operator types after the program name. */
    readonly name: string
    /** Runs the command with the arguments after its name; the answer is the exit code (0 is success). */
    run(args: ReadonlyArray<string>): Promise<number>
}
