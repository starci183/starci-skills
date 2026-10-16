import { Module } from "@nestjs/common"
import { ToolStatusModule } from "../../tool-status.module"
import { StatusController } from "./status.controller"
import { ConfigurableModuleClass } from "./tool-status-http.module-definition"

@Module({ imports: [ToolStatusModule.register({})], controllers: [StatusController] })
/** The HTTP transport of the tool-status feature: one credential-marked status door. */
export class ToolStatusHttpModule extends ConfigurableModuleClass {}
