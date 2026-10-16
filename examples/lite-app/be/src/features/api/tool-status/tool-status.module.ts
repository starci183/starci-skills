import { Module } from "@nestjs/common"
import { GetToolStatusHandler } from "./application/get-tool-status.handler"
import { ConfigurableModuleClass } from "./tool-status.module-definition"

@Module({ providers: [GetToolStatusHandler] })
/** Application module of the tool-status feature: the handler of the credential-marked status query. */
export class ToolStatusModule extends ConfigurableModuleClass {}
