import {
    Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Post, Put, Query, Req, Res, StreamableFile, UseFilters 
} from "@nestjs/common"
import type {
    Request, Response 
} from "express"
import {
    SessionService 
} from "@modules/bussiness/session/session.service"
import {
    PresignedUpload, UploadRecord 
} from "@modules/integrations/upload/upload.contracts"
import {
    UPLOAD_TOKEN_HEADER 
} from "@modules/integrations/upload/upload-token"
import {
    UploadService 
} from "@modules/integrations/upload/upload.service"
import {
    UploadMimeNotAllowedException 
} from "@modules/shared/exceptions/errors/upload/upload-mime-not-allowed"
import {
    UploadTooLargeException 
} from "@modules/shared/exceptions/errors/upload/upload-too-large"
import {
    actorIdFromRequest 
} from "../../graphql/session-actor.adapter"
import {
    UploadExceptionFilter 
} from "./upload-exception.filter"

interface UploadIntentBody {
  readonly filename?: string;
  readonly mime?: string;
  readonly sizeBytes?: number;
}

interface AttachBody {
  readonly taskId?: string;
}

/**
 * The feature's second plain-HTTP door (beside `health/` and `webhooks/sepay/`): upload is the one
 * owner-facing flow that cannot live on GraphQL, because the presigned PUT and the direct POST move
 * raw bytes, not JSON. Control-plane verbs still look like the house style - intents and attach are
 * JSON POSTs authenticated by the same `Authorization: Bearer <token>` session the GraphQL resolvers
 * read through session-actor.adapter. The data plane deliberately needs no session: the presigned
 * `x-upload-token` is the credential, exactly like an S3 presigned URL needs no second auth.
 */
@Controller("uploads")
@UseFilters(UploadExceptionFilter)
/** The upload HTTP door: intents + direct POST + presigned PUT + attach + download + delete. */
export class UploadController {
    constructor(
    private readonly uploads: UploadService,
    private readonly sessionService: SessionService,
    ) {}

    /** POST /uploads/intents - opens a pending upload and returns the presigned PUT contract. */
    @Post("intents")
    async createIntent(@Req() req: Request, @Body() body: UploadIntentBody): Promise<PresignedUpload> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        return this.uploads.createIntent(actorId,
            body?.filename ?? "",
            body?.mime ?? "",
            Number(body?.sizeBytes))
    }

    /** POST /uploads?filename=<name> - the direct intake: the request's own content-type is the declared
   * mime and the raw body (parsed by this module's express.raw middleware) is the object. */
    @Post()
    async createDirect(
    @Req() req: Request,
        @Query("filename") filename: string | undefined,
        @Headers("content-type") contentType: string | undefined,
    ): Promise<UploadRecord> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        const mime = (contentType ?? "").split(";")[0].trim()
        if (!mime) {
            throw new UploadMimeNotAllowedException({
                mime: "(missing)" 
            })
        }
        return this.uploads.createDirect(actorId,
            filename ?? "file",
            mime,
            bodyBuffer(req))
    }

    /** PUT /uploads/:uploadId/content - the presigned data plane: x-upload-token is the credential,
   * the raw body is the object. */
    @Put(":uploadId/content")
    @HttpCode(HttpStatus.OK)
    async putContent(
    @Param("uploadId") uploadId: string,
        @Headers(UPLOAD_TOKEN_HEADER) token: string | undefined,
        @Req() req: Request,
    ): Promise<UploadRecord> {
        return this.uploads.acceptContent(uploadId,
            token,
            bodyBuffer(req))
    }

    /** POST /uploads/:uploadId/attach - points a ready upload at a task the caller owns. */
    @Post(":uploadId/attach")
    async attach(
    @Param("uploadId") uploadId: string,
        @Body() body: AttachBody,
        @Req() req: Request,
    ): Promise<UploadRecord> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        return this.uploads.attach(uploadId,
            body?.taskId ?? "",
            actorId)
    }

    /** GET /uploads?taskId=<id> - the task's attachments, for the task's owner only. */
    @Get()
    async listForTask(@Query("taskId") taskId: string | undefined, @Req() req: Request): Promise<Array<UploadRecord>> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        return this.uploads.listForTask(taskId ?? "",
            actorId)
    }

    /** GET /uploads/:uploadId/content - downloads the object for its owner, with the stored mime and
   * filename on the response. */
    @Get(":uploadId/content")
    async download(
    @Param("uploadId") uploadId: string,
        @Req() req: Request,
        @Res({
            passthrough: true 
        }) res: Response,
    ): Promise<StreamableFile> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        const { record, content } = await this.uploads.readContent(uploadId,
            actorId)
        res.setHeader("content-type",
            record.mime)
        res.setHeader("content-disposition",
            `attachment; filename="${record.filename.replace(/"/g,
                "")}"`)
        res.setHeader("content-length",
            String(content.length))
        return new StreamableFile(content)
    }

    /** DELETE /uploads/:uploadId - removes the row and the stored object, for the owner only. */
    @Delete(":uploadId")
    async remove(@Param("uploadId") uploadId: string, @Req() req: Request): Promise<{ deleted: boolean }> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        await this.uploads.remove(uploadId,
            actorId)
        return {
            deleted: true 
        }
    }
}

/**
 * The raw body this module's express.raw middleware put on the request, or an empty buffer when the
 * earlier json parser already consumed the stream (a client that PUTs content-type: application/json
 * never reaches storage - the empty body fails the service's size floor as UploadTooLargeException).
 */
function bodyBuffer(req: Request): Buffer {
    if (Buffer.isBuffer(req.body)) return req.body
    if (typeof req.body === "string") return Buffer.from(req.body)
    if (req.body && typeof req.body === "object") {
        // A pre-parsed body means the request never carried bytes this door accepts.
        throw new UploadMimeNotAllowedException({
            mime: "application/json" 
        })
    }
    throw new UploadTooLargeException({
        sizeBytes: 0 
    })
}
