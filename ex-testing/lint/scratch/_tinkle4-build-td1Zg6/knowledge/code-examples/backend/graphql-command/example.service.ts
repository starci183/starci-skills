import {
    Injectable,
} from "@nestjs/common"
import {
    CommandBus,
} from "@nestjs/cqrs"
import {
    ExecuteParams,
} from "@features/api/core/types/execute"
import {
    ExampleCreateItemCommand,
} from "./example.command"
import type {
    ExampleCreateItemRequest,
} from "./graphql-types/request"
import type {
    ExampleItemEntity,
} from "./graphql-types/response"

@Injectable()
/** Thin feature service: forwards to CommandBus only — no persistence. */
export class ExampleCreateItemService {
    constructor(
        private readonly commandBus: CommandBus,
    ) {}

    /**
     * Dispatches the create-item command and returns the resulting row.
     *
     * @param params - Request/user/locale context for the mutation.
     * @returns The example item row after create-or-return.
     */
    async execute(
        params: ExecuteParams<ExampleCreateItemRequest>,
    ): Promise<ExampleItemEntity> {
        return this.commandBus.execute(
            new ExampleCreateItemCommand(params),
        )
    }
}
