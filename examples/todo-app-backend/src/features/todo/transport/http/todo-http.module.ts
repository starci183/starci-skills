import {
    Module
} from "@nestjs/common"
import {
    HealthModule
} from "./health/health.module"
import {
    ProbesModule
} from "./health/probes/probes.module"
import {
    UploadHttpModule
} from "./upload/upload.module"
import {
    SepayWebhookModule
} from "./webhooks/sepay/sepay-webhook.module"

/** The todo feature's HTTP doors: health, probes, the upload data plane and the SePay webhook. */
@Module({
    imports: [
        HealthModule.register(),
        ProbesModule.register(),
        SepayWebhookModule.register(),
        UploadHttpModule.register(),
    ],
})
/** Composition for the todo HTTP transport; the feature module imports it once. */
export class TodoHttpModule {}
