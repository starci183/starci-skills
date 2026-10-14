import type { Type } from "@nestjs/common"
import { CliModule } from "@features/cli"

/** The CLI feature root exposes the operator commands. */
export const commandsModules = (): Array<Type<unknown>> => [CliModule]
