import type { DynamicModule, Type } from "@nestjs/common"
import { SystemHealthHttpModule } from "@features/api/system-health"

/** The system probes of the app, registered independently of product API doors. */
export const systemModules = (): Array<Type<unknown> | DynamicModule> => [SystemHealthHttpModule.register({})]
