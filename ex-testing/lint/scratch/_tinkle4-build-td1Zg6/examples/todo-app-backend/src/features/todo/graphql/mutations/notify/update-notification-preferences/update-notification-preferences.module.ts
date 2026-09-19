import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./update-notification-preferences.module-definition"
import {
    UpdateNotificationPreferencesResolver 
} from "./update-notification-preferences.resolver"

/** See mutations/task/create-task/create-task.module.ts's comment: SessionService reaches this resolver
 * through the app's one global SessionModule registration, not through an import here. */
@Module({
    imports: [CqrsModule],
    providers: [UpdateNotificationPreferencesResolver],
})
/** updateNotificationPreferences' module: mounts UpdateNotificationPreferencesResolver; the command handler is discovered app-wide through CqrsModule. */
export class UpdateNotificationPreferencesSingleMutationModule extends ConfigurableModuleClass {}
