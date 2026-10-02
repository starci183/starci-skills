import { CommandRunner, SubCommand } from "nest-commander"
import { @@service@@ } from "@@serviceModule@@"

@SubCommand({ name: "run", description: "Run @@group@@" })
/** `cli @@group@@ run`: calls the domain service; no decision here. */
export class RunCli extends CommandRunner {
    constructor(private readonly @@serviceCamel@@: @@service@@) {
        super()
    }

    /** Runs @@group@@ through the domain service. */
    async run(): Promise<void> {
        await this.@@serviceCamel@@.@@groupCamel@@()
    }
}
