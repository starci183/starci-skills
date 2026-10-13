import { Module } from "@nestjs/common"
import { CreateResourceHandler } from "./application/create-resource.handler"
import { GetResourceHandler } from "./application/get-resource.handler"

@Module({ providers: [GetResourceHandler, CreateResourceHandler] })
/** The resources feature: the handlers of its application. */
export class ResourcesApiModule {}
