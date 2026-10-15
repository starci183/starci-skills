import { Module } from "@nestjs/common"
import { SeedCli } from "./seed.cli"
import { ConfigurableModuleClass } from "./seed.module-definition"
import { RunSeedsCli } from "./subs/run.cli"

@Module({ providers: [SeedCli, RunSeedsCli] })
/** The lite seed group: the command and its one tracked Supabase seed runner. */
export class SeedModule extends ConfigurableModuleClass {}
