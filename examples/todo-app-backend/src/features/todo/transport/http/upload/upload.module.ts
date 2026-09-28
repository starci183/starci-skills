import {
    DynamicModule, MiddlewareConsumer, Module, NestModule, RequestMethod 
} from "@nestjs/common"
import {
    raw 
} from "express"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./upload.module-definition"
import {
    UploadController 
} from "./upload.controller"

/**
 * Transport backstop for the two byte-bearing routes, well above the business cap UploadService
 * enforces (AppConfigService.getUploadMaxBytes, 10 MiB by default): express.raw refuses bodies past
 * this limit with a plain 413 before the service's own UPLOAD_TOO_LARGE refusal can run, which is the
 * point of a transport bound - a 200MB body dies in the parser, not in a Buffer allocation.
 */
const UPLOAD_TRANSPORT_LIMIT_BYTES = 64 * 1024 * 1024

/**
 * Mounts UploadController beside its feature - the same spot `health/` and `webhooks/sepay/` already
 * occupy - and wires the one middleware this door needs: express.raw over exactly the two byte routes
 * (POST /uploads direct, PUT /uploads/:id/content presigned fulfilment), so req.body arrives as a
 * Buffer. The global json parser still owns every other route; `raw` only ever sees these two because
 * forRoutes names them and nothing else.
 *
 * UploadService is not imported here: UploadModule is registered globally from app.module.ts, the same
 * answer SessionModule gives the GraphQL resolvers - eslint's no-non-global-module-import forbids a
 * feature module importing a capability module directly.
 */
@Module({
})
/** Nest module wiring the upload HTTP door; the app composition root registers it - other modules never import it. */
export class UploadHttpModule extends ConfigurableModuleClass implements NestModule {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base, controllers: [UploadController] 
        }
    }

    configure(consumer: MiddlewareConsumer): void {
        consumer
            .apply(raw({
                type: () => true, limit: UPLOAD_TRANSPORT_LIMIT_BYTES 
            }))
            .forRoutes({
                path: "uploads", method: RequestMethod.POST 
            },
            {
                path: "uploads/:uploadId/content", method: RequestMethod.PUT 
            })
    }
}
