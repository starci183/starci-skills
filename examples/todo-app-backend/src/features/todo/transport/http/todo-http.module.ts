import { Module, RequestMethod } from "@nestjs/common"
import type { MiddlewareConsumer, NestModule } from "@nestjs/common"
import { raw } from "express"
import { TodoModule } from "../../todo.module"
import { SepayWebhookController } from "./sepay-webhook.controller"
import { UploadController } from "./upload.controller"

/** The hard ceiling of a raw body; the upload capability enforces its own, smaller, configured limit. */
const RAW_BODY_LIMIT = "100mb"

@Module({
    imports: [TodoModule],
    controllers: [SepayWebhookController, UploadController],
})
/** The HTTP transport of the todo feature: the signed Sepay webhook and the upload byte stream; uploads read the body as raw bytes. */
export class TodoHttpModule implements NestModule {
    /** Applies the raw body parser to the two routes that receive bytes. */
    configure(consumer: MiddlewareConsumer): void {
        consumer
            .apply(raw({ type: () => true, limit: RAW_BODY_LIMIT }))
            .forRoutes(
                { path: "uploads", method: RequestMethod.POST },
                { path: "uploads/:uploadId/content", method: RequestMethod.PUT },
            )
    }
}
