import type { DynamicModule, Type } from "@nestjs/common"

/** The signed webhook transports and durable inbox capabilities of the API app. */
export const webhooksModules = (): Array<Type<unknown> | DynamicModule> => []
