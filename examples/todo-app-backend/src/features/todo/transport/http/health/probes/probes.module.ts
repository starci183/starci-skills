import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./probes.module-definition"
import {
    ProbesController 
} from "./probes.controller"

@Module({
})
/** Mounts ProbesController beside /health; postgres is global from app.module.ts and MetricsService is global from the observability capability's own register(). */
export class ProbesModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base, controllers: [ProbesController] 
        }
    }
}
