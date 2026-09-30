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
    StreamableFile,
} from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import type { Request } from "express"
import { CurrentPrincipal, Public, PublicReason } from "@modules/domain/identity"
import { UPLOAD_TOKEN_HEADER } from "@modules/domain/upload"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
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
import { toDownloadFile, toUploadResponse } from "./upload-response.mapper"

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
        return toUploadResponse(
            await this.commandBus.execute(
                new CreateDirectUploadCommand({
                    request: toDirectUploadRequest(query, contentType, toUploadBody(request.body)),
                    principal,
                }),
            ),
        )
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
        return toUploadResponse(
            await this.commandBus.execute(
                new AcceptUploadContentCommand({
                    request: toAcceptUploadContentRequest(params, token, toUploadBody(request.body)),
                }),
            ),
        )
    }

    /** GET /uploads/:uploadId/content: downloads the bytes for the owner with the stored media type and file name. */
    @Get(":uploadId/content")
    async download(@CurrentPrincipal() principal: Principal, @Param() params: UploadContentRequest): Promise<StreamableFile> {
        return toDownloadFile(
            await this.queryBus.execute(new ReadUploadContentQuery({ request: toReadUploadContentRequest(params), principal })),
        )
    }
}
