import { Module } from "@nestjs/common"
import { @@Feature@@ApiModule } from "../../@@feature@@.module"
import { @@Action@@Resolver } from "./@@action@@.resolver"

@Module({ imports: [@@Feature@@ApiModule], providers: [@@Action@@Resolver] })
/** The GraphQL transport of the @@feature@@ feature. */
export class @@Feature@@GraphqlModule {}
