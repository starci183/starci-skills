import type { DynamicModule, Type } from "@nestjs/common"
import { CliModule } from "@features/cli"

/** The command groups of the CLI app. */
export const cliModules = (): Array<Type<unknown> | DynamicModule> => [CliModule]
