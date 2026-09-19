import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./health.module-definition"
import {
    HealthController 
} from "./health.controller"

@Module({
})
/** Mounts HealthController beside its feature; the primary postgres module it probes is global from `app.module.ts`. */
export class HealthModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base, controllers: [HealthController] 
        }
    }
}
