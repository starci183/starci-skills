import type { DynamicModule } from "@nestjs/common"
import { SystemHealthHttpModule } from "@features/api/system-health"

/** HTTP feature doors of the core app. */
export const apiModules = (): Array<DynamicModule> => [SystemHealthHttpModule.register({})]
