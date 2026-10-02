import { Module } from "@nestjs/common"
import { MigrateCli } from "./migrate.cli"
import { RunCli } from "./subs/run.cli"

@Module({ providers: [MigrateCli, RunCli] })
/** The migrate group: its command and its sub-commands; the connections come from the database capability. */
export class MigrateModule {}
