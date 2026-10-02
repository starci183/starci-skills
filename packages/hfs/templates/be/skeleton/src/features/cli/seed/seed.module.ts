import { Module } from "@nestjs/common"
import { SeedCli } from "./seed.cli"
import { READ_SEED_FILES, RunSeedsCli, readSeedFiles } from "./subs/run.cli"

@Module({
    providers: [SeedCli, RunSeedsCli, { provide: READ_SEED_FILES, useValue: readSeedFiles }],
})
/** The seed group: its command, its sub-commands and the seed file reader; the connections come from the database capability. */
export class SeedModule {}
