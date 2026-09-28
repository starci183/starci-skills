import {
    Module
} from "@nestjs/common"
import {
    TodoGraphqlModule
} from "./transport/graphql/graphql.module"
import {
    HealthModule
} from "./transport/http/health/health.module"
import {
    ProbesModule
} from "./transport/http/health/probes/probes.module"
import {
    UploadHttpModule
} from "./transport/http/upload/upload.module"
import {
    SepayWebhookModule
} from "./transport/http/webhooks/sepay/sepay-webhook.module"

/** The todo feature owns its GraphQL and HTTP transport registrations. */
@Module({
    imports: [
        TodoGraphqlModule,
        HealthModule.register(),
        ProbesModule.register(),
        SepayWebhookModule.register(),
        UploadHttpModule.register(),
    ],
})
/** Public Nest module for the todo feature's GraphQL and HTTP doors. */
export class TodoModule {}
