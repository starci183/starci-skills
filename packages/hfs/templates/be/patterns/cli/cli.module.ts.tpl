import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectCliRegistry } from "@modules/platform/cli"
import type { CliRegistry } from "@modules/platform/cli"
import { @@Command@@Module } from "../../@@command@@.module"
import { @@Command@@Cli } from "./@@command@@.cli"

@Module({ imports: [@@Command@@Module], providers: [@@Command@@Cli] })
/** The cli transport of the @@command@@ command: it registers the entry with the command line of the app. */
export class @@Command@@CliModule implements OnModuleInit {
    constructor(
        @InjectCliRegistry() private readonly registry: CliRegistry,
        private readonly entry: @@Command@@Cli,
    ) {}

    /** Hands the entry to the registry. */
    onModuleInit(): void {
        this.registry.add(this.entry)
    }
}
