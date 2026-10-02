import { Module } from "@nestjs/common"
import { @@Feature@@Module } from "../../@@feature@@.module"
import { @@Action@@Controller } from "./@@action@@.controller"

@Module({ imports: [@@Feature@@Module], controllers: [@@Action@@Controller] })
/** The HTTP transport of the @@feature@@ feature. */
export class @@Feature@@HttpModule {}
