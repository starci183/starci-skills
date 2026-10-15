import { Module } from "@nestjs/common"
import { CreateResourceHandler } from "./application/create-resource.handler"
import { GetResourceHandler } from "./application/get-resource.handler"
import { ConfigurableModuleClass } from "./resources.module-definition"

@Module({ providers: [GetResourceHandler, CreateResourceHandler] })
/** The resources feature: the handlers of its application. */
export class ResourcesApiModule extends ConfigurableModuleClass {}
