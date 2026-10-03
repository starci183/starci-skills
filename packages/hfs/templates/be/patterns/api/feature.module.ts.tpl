import { Module } from "@nestjs/common"
import { @@Action@@Handler } from "./application/@@action@@.handler"

@Module({ providers: [@@Action@@Handler] })
/** The @@feature@@ feature: the handlers of its application. */
export class @@Feature@@ApiModule {}
