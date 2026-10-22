import type { ExecutionContext } from "@nestjs/common"
import { GqlExecutionContext } from "@nestjs/graphql"
import type { OperationRequest } from "./http-security.contracts"

/** The GraphQL context the drivers build: the request the operation arrived on. */
interface GraphqlRequestContext {
    /** The request. */
    readonly req: OperationRequest
}

/** The request behind an execution context, whether the door is a REST controller, a GraphQL resolver or a subscription. */
export const requestOf = (context: ExecutionContext): OperationRequest =>
    context.getType<string>() === "graphql"
        ? GqlExecutionContext.create(context).getContext<GraphqlRequestContext>().req
        : context.switchToHttp().getRequest<OperationRequest>()
