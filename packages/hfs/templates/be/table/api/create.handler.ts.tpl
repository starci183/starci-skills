import { CommandHandler } from "@nestjs/cqrs"
import { {{Name}}Service } from "@modules/domain/{{name}}"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { Create{{Singular}}Command } from "./create-{{singular}}.command"
import type { Create{{Singular}}Result } from "./create-{{singular}}.contracts"

@CommandHandler(Create{{Singular}}Command)
/** Creates one {{singular}} row for the authenticated principal through one domain-service call. */
export class Create{{Singular}}Handler extends ICQRSHandler<Create{{Singular}}Command, Create{{Singular}}Result> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly {{nameCamel}}Service: {{Name}}Service,
    ) {
        super(logger)
    }

    protected override process(command: Create{{Singular}}Command): Promise<Create{{Singular}}Result> {
        return this.{{nameCamel}}Service.create{{Singular}}(command.params.principal.id)
    }
}
