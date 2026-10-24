import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./@@channel@@-sse.module-definition"
import { @@Channel@@Controller } from "./@@channel@@.controller"

@Module({ controllers: [@@Channel@@Controller] })
/** The server-sent-events transport of the @@channel@@ channel: one authenticated stream per principal. */
export class @@Channel@@SseModule extends ConfigurableModuleClass {}
