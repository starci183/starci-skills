import { QueryHandler } from "@nestjs/cqrs"
import { {{Name}}Service } from "@modules/domain/{{name}}"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { Get{{Singular}}Result } from "./get-{{singular}}.contracts"
import { Get{{Singular}}Query } from "./get-{{singular}}.query"

@QueryHandler(Get{{Singular}}Query)
/** Answers one {{singular}} row of the authenticated principal through one domain-service call. */
export class Get{{Singular}}Handler extends ICQRSHandler<Get{{Singular}}Query, Get{{Singular}}Result> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly {{nameCamel}}Service: {{Name}}Service,
    ) {
        super(logger)
    }

    protected override process(query: Get{{Singular}}Query): Promise<Get{{Singular}}Result> {
        return this.{{nameCamel}}Service.{{nameCamel}}(query.params.principal.id, query.params.request.id)
    }
}
