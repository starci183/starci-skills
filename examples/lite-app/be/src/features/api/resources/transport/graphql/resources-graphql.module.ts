import { Module } from "@nestjs/common"
import { ResourcesApiModule } from "../../resources.module"
import { CreateResourceResolver } from "./create-resource.resolver"
import { GetResourceResolver } from "./get-resource.resolver"

@Module({ imports: [ResourcesApiModule], providers: [GetResourceResolver, CreateResourceResolver] })
/** The GraphQL transport of the resources feature. */
export class ResourcesGraphqlModule {}
