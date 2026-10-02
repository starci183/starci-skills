import { Module } from "@nestjs/common"
import { @@Group@@Cli } from "./@@group@@.cli"
import { RunCli } from "./subs/run.cli"

@Module({ providers: [@@Group@@Cli, RunCli] })
/** The @@group@@ group: its command and its sub-commands; the work is the runner service the sub-command delegates to. */
export class @@Group@@Module {}
