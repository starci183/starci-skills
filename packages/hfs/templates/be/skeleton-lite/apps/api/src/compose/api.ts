import type { DynamicModule, Type } from "@nestjs/common"

/** The API transports of the app; `starci app add api` registers each generated door here. */
export const apiModules = (): Array<Type<unknown> | DynamicModule> => []
