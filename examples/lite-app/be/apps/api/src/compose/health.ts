import type { DynamicModule } from "@nestjs/common"
import { SystemHealthHttpModule } from "@features/api/system-health"
import { ToolStatusHttpModule } from "@features/api/tool-status"
import { LivenessModule } from "@modules/domain/liveness"

/** Registers the status capability and its health and tool HTTP doors. */
export const healthModules = (): Array<DynamicModule> => [
    LivenessModule.register({ isGlobal: true }),
    SystemHealthHttpModule.register({}),
    ToolStatusHttpModule.register({}),
]
