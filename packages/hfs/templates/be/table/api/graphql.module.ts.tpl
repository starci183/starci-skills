import { Module } from "@nestjs/common"
import { {{Name}}ApiModule } from "../../{{name}}.module"
import { Create{{Singular}}Resolver } from "./create-{{singular}}.resolver"
import { Get{{Singular}}Resolver } from "./get-{{singular}}.resolver"
import { ConfigurableModuleClass } from "./{{name}}-graphql.module-definition"

@Module({ imports: [{{Name}}ApiModule.register({})], providers: [Get{{Singular}}Resolver, Create{{Singular}}Resolver] })
/** The GraphQL transport of the {{name}} feature. */
export class {{Name}}GraphqlModule extends ConfigurableModuleClass {}
