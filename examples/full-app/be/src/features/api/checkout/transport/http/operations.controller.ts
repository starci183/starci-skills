import { Body, Controller, Post } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import type { OPERATIONS } from "@modules/domain/order"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { OperationValidationService } from "@modules/platform/http-security"
import type { OperationReply, OperationRequest } from "@modules/platform/operations"
import { ListOrdersQuery } from "../../application/list-orders.query"
import { OrdersListRequest } from "./dto/orders-list.request"
import { toOperationReply } from "./orders-operation.mapper"

@Controller()
/** POST /operations, the one versioned operation route of the order api: the caller pages through their own orders. */
export class OperationsController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Answers `orders.list@1`; the body is validated against the envelope class before it reaches this method. */
    @Post("operations")
    async invoke(
        @CurrentPrincipal() principal: Principal,
        @Body(new OperationValidationService(OrdersListRequest)) request: OperationRequest<typeof OPERATIONS>,
    ): Promise<OperationReply<typeof OPERATIONS>> {
        const outcome = await this.queryBus.execute(new ListOrdersQuery({ request: request.input, principal }))
        return toOperationReply(request, outcome)
    }
}
