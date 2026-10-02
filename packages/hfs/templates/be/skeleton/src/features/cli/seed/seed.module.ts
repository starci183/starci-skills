import { Module } from "@nestjs/common"
import { SeedCli } from "./seed.cli"
import { RunSeedsCli } from "./subs/run.cli"

@Module({ providers: [SeedCli, RunSeedsCli] })
/** The seed group: its command and its sub-commands; the connections and the seed file reader come from the database capability. */
export class SeedModule {}
