import { Module } from "@nestjs/common"
import { @@Feature@@ApiModule } from "../../@@feature@@.module"
import { @@Action@@Resolver } from "./@@action@@.resolver"
import { ConfigurableModuleClass } from "./@@feature@@-graphql.module-definition"

@Module({ imports: [@@Feature@@ApiModule.register({})], providers: [@@Action@@Resolver] })
/** The GraphQL transport of the @@feature@@ feature. */
export class @@Feature@@GraphqlModule extends ConfigurableModuleClass {}
