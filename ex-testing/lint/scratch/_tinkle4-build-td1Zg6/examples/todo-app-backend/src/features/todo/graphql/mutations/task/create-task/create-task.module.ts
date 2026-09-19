import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./create-task.module-definition"
import {
    CreateTaskResolver 
} from "./create-task.resolver"

/**
 * `SessionService` (needed by the resolver to turn `Authorization: Bearer <token>` into an actor id) is not imported
 * here: `bussiness/session`'s SessionModule is registered exactly once, globally, from `app.module.ts`
 * (`SessionModule.register({ isGlobal: true })`), because five separate GraphQL action modules
 * (create/complete/reopen/delete/list task) all need the same authenticated-actor lookup. Registering
 * it non-globally from each of them would construct five independent SessionModule graphs (and rebind
 * SignIn/SignOutHandler five times over) for what is genuinely one app-wide capability - exactly the
 * `isGlobal` knob every capability module's `module-definition.ts` exists to make an explicit choice
 * rather than an accident.
 */
@Module({
    imports: [CqrsModule],
    providers: [CreateTaskResolver],
})
/** createTask's module: mounts CreateTaskResolver; the command handler is discovered app-wide through CqrsModule. */
export class CreateTaskSingleMutationModule extends ConfigurableModuleClass {}
