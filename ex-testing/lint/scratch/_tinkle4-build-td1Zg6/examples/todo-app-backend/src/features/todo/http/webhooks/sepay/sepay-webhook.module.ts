import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./sepay-webhook.module-definition"
import {
    SepayWebhookController 
} from "./sepay-webhook.controller"

/**
 * Mounts SepayWebhookController, mirroring HealthModule's own placement (a plain HTTP door registered
 * beside its own feature, not under `modules/platform`). `SepayModule` is not imported here - it is
 * registered globally from `app.module.ts`, so the `SepayClient` this controller injects resolves
 * ambiently. `PlanModule` is not imported either - `ConfirmPaymentCommand`'s handler is discovered by
 * @nestjs/cqrs's app-wide explorer once PlanModule is anywhere in the compiled module graph (it is,
 * from app.module.ts), the same reason create-task.module.ts never imports TaskModule to reach
 * CreateTaskHandler.
 */
@Module({
})
/** Mounts SepayWebhookController; SepayClient resolves through the global registration in `app.module.ts`. */
export class SepayWebhookModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [CqrsModule],
            controllers: [SepayWebhookController],
        }
    }
}
