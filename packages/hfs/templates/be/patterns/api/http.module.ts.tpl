import { Module } from "@nestjs/common"
import { @@Feature@@ApiModule } from "../../@@feature@@.module"
import { @@Action@@Controller } from "./@@action@@.controller"

@Module({ imports: [@@Feature@@ApiModule], controllers: [@@Action@@Controller] })
/** The HTTP transport of the @@feature@@ feature. */
export class @@Feature@@HttpModule {}
