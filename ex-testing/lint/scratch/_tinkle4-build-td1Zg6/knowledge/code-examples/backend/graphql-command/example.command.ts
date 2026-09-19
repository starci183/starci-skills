import {
    ExecuteParams,
} from "@features/api/core/types/execute"
import {
    ExampleCreateItemRequest,
} from "./graphql-types/request"

/** Inert CQRS command envelope — params only, no methods or derived fields. */
export class ExampleCreateItemCommand {
    constructor(
        readonly params: ExecuteParams<ExampleCreateItemRequest>,
    ) {}
}
