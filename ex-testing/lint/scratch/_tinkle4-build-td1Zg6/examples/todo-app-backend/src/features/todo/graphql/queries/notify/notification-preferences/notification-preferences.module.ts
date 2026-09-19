import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./notification-preferences.module-definition"
import {
    NotificationPreferencesResolver 
} from "./notification-preferences.resolver"

@Module({
    imports: [CqrsModule],
    providers: [NotificationPreferencesResolver],
})
/** notificationPreferences' module: mounts NotificationPreferencesResolver; the query handler is discovered app-wide through CqrsModule. */
export class NotificationPreferencesSingleQueryModule extends ConfigurableModuleClass {}
