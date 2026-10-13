import { CommandHandler } from "@nestjs/cqrs"
import { ResourcesService } from "@modules/domain/resources"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateResourceCommand } from "./create-resource.command"
import type { CreateResourceResult } from "./create-resource.contracts"

@CommandHandler(CreateResourceCommand)
/** Creates one resource row for the authenticated principal through one domain-service call. */
export class CreateResourceHandler extends ICQRSHandler<CreateResourceCommand, CreateResourceResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly resourcesService: ResourcesService,
    ) {
        super(logger)
    }

    protected override process(command: CreateResourceCommand): Promise<CreateResourceResult> {
        return this.resourcesService.createResource(command.params.principal.id)
    }
}
