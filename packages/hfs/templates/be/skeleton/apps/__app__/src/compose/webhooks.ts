import type { DynamicModule, Type } from "@nestjs/common"

/** The signed webhook transports of the app; `starci app add webhook` registers each generated door here. */
export const webhooksModules = (): Array<Type<unknown> | DynamicModule> => []
