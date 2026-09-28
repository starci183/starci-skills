import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./downgrade-plan.module-definition"
import {
    DowngradePlanResolver 
} from "./downgrade-plan.resolver"

/** PlanModule is not imported here; see upgrade-plan.module.ts's comment. */
@Module({
    imports: [CqrsModule],
    providers: [DowngradePlanResolver],
})
/** downgradePlan's module: mounts DowngradePlanResolver; the command handler is discovered app-wide through CqrsModule. */
export class DowngradePlanSingleMutationModule extends ConfigurableModuleClass {}
