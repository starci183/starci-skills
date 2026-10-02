import { Module } from "@nestjs/common"
import { CLI_REGISTRY, CLI_RUNNER } from "./cli.decorators"
import { CliRunnerService } from "./cli-runner.service"

@Module({
    providers: [
        CliRunnerService,
        { provide: CLI_REGISTRY, useExisting: CliRunnerService },
        { provide: CLI_RUNNER, useExisting: CliRunnerService },
    ],
    exports: [CLI_REGISTRY, CLI_RUNNER],
})
/** The command line of an app of kind cli: the registry the command modules register with and the runner the app entry calls. */
export class CliModule {}
