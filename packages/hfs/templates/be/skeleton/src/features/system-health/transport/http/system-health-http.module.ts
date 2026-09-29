import { Module } from "@nestjs/common"
import { TerminusModule } from "@nestjs/terminus"
import { LiveController } from "./live.controller"

/** The HTTP transport of the health feature. */
@Module({
    imports: [TerminusModule],
    controllers: [LiveController],
})
export class SystemHealthHttpModule {}
