import {
    Controller,
    Get,
    Headers,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Put,
    Query,
    Req,
    Res,
    StreamableFile,
} from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import type { Request, Response } from "express"
import { CurrentPrincipal, Public, PublicReason } from "@modules/domain/identity"
import { UPLOAD_TOKEN_HEADER, UploadError } from "@modules/domain/upload"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { unwrapOutcome } from "@modules/platform/primitives"
import { AcceptUploadContentCommand } from "../../application/accept-upload-content.command"
import { CreateDirectUploadCommand } from "../../application/create-direct-upload.command"
import { ReadUploadContentQuery } from "../../application/read-upload-content.query"
import { DirectUploadRequest, UploadContentRequest } from "./dto/upload.request"
import type { UploadResponse } from "./dto/upload.response"
import { toUploadBody } from "./upload-body.mapper"
import {
    toAcceptUploadContentRequest,
    toDirectUploadRequest,
    toReadUploadContentRequest,
} from "./upload-request.mapper"
import { toDownloadHeaders, toUploadResponse } from "./upload-response.mapper"

/** What a body-less request stores: nothing, which the intake rules refuse as an empty file. */
const NO_BYTES = Buffer.alloc(0)

@Controller("uploads")
/**
 * The byte plane of the uploads: the only REST door of the upload flow, because bytes cannot travel as GraphQL. The
 * control plane (intent, attach, list, delete) is GraphQL. The raw-body middleware of these routes puts the bytes on
 * the request as a Buffer.
 */
export class UploadController {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
    ) {}

    /** POST /uploads?filename=name: the direct intake, authenticated by the session; the content type is the declared media type. */
    @Post()
    async createDirectUpload(
        @CurrentPrincipal() principal: Principal,
        @Query() query: DirectUploadRequest,
        @Headers("content-type") contentType: string | undefined,
        @Req() request: Request,
    ): Promise<UploadResponse> {
        const content = toUploadBody(request.body) ?? NO_BYTES
        const outcome = await this.commandBus.execute(
            new CreateDirectUploadCommand({ request: toDirectUploadRequest(query, contentType, content), principal }),
        )
        return toUploadResponse(unwrapOutcome(outcome, UploadError))
    }

    /** PUT /uploads/:uploadId/content: the presigned data plane; the token header is the credential, so there is no session. */
    @Put(":uploadId/content")
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    @HttpCode(HttpStatus.OK)
    async putContent(
        @Param() params: UploadContentRequest,
        @Headers(UPLOAD_TOKEN_HEADER) token: string | undefined,
        @Req() request: Request,
    ): Promise<UploadResponse> {
        const content = toUploadBody(request.body) ?? NO_BYTES
        const outcome = await this.commandBus.execute(
            new AcceptUploadContentCommand({ request: toAcceptUploadContentRequest(params, token, content) }),
        )
        return toUploadResponse(unwrapOutcome(outcome, UploadError))
    }

    /** GET /uploads/:uploadId/content: downloads the bytes for the owner with the stored media type and file name. */
    @Get(":uploadId/content")
    async download(
        @CurrentPrincipal() principal: Principal,
        @Param() params: UploadContentRequest,
        @Res({ passthrough: true }) response: Response,
    ): Promise<StreamableFile> {
        const outcome = await this.queryBus.execute(
            new ReadUploadContentQuery({ request: toReadUploadContentRequest(params), principal }),
        )
        const upload = unwrapOutcome(outcome, UploadError)
        for (const [name, value] of Object.entries(toDownloadHeaders(upload))) response.setHeader(name, value)
        return new StreamableFile(upload.content)
    }
}
