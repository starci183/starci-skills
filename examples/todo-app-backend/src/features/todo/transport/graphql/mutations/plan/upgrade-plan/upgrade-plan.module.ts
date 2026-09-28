import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./upgrade-plan.module-definition"
import {
    UpgradePlanResolver 
} from "./upgrade-plan.resolver"

/** PlanModule is not imported here: it is registered once from app.module.ts, and
 * @nestjs/cqrs's app-wide explorer discovers UpgradePlanHandler from anywhere in the compiled module
 * graph - the same reason create-task.module.ts never imports TaskModule to reach CreateTaskHandler. */
@Module({
    imports: [CqrsModule],
    providers: [UpgradePlanResolver],
})
/** upgradePlan's module: mounts UpgradePlanResolver; the command handler is discovered app-wide through CqrsModule. */
export class UpgradePlanSingleMutationModule extends ConfigurableModuleClass {}
