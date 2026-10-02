import { Module } from "@nestjs/common"
import { @@Feature@@Module } from "../../@@feature@@.module"
import { @@Action@@Resolver } from "./@@action@@.resolver"

@Module({ imports: [@@Feature@@Module], providers: [@@Action@@Resolver] })
/** The GraphQL transport of the @@feature@@ feature. */
export class @@Feature@@GraphqlModule {}
