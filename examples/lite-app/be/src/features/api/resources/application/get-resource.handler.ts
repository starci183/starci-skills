import { QueryHandler } from "@nestjs/cqrs"
import { ResourcesService } from "@modules/domain/resources"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GetResourceResult } from "./get-resource.contracts"
import { GetResourceQuery } from "./get-resource.query"

@QueryHandler(GetResourceQuery)
/** Answers one resource row of the authenticated principal through one domain-service call. */
export class GetResourceHandler extends ICQRSHandler<GetResourceQuery, GetResourceResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly resourcesService: ResourcesService,
    ) {
        super(logger)
    }

    protected override process(query: GetResourceQuery): Promise<GetResourceResult> {
        return this.resourcesService.resources(query.params.principal.id, query.params.request.id)
    }
}
