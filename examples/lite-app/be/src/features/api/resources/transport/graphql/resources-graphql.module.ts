import { Module } from "@nestjs/common"
import { ResourcesApiModule } from "../../resources.module"
import { CreateResourceResolver } from "./create-resource.resolver"
import { GetResourceResolver } from "./get-resource.resolver"
import { ConfigurableModuleClass } from "./resources-graphql.module-definition"

@Module({ imports: [ResourcesApiModule.register({})], providers: [GetResourceResolver, CreateResourceResolver] })
/** The GraphQL transport of the resources feature. */
export class ResourcesGraphqlModule extends ConfigurableModuleClass {}
