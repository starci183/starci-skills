import type { ExecutionContext } from "@nestjs/common"
import { GqlExecutionContext } from "@nestjs/graphql"
import type { Request } from "express"

/** The GraphQL context the drivers build: the HTTP request the operation arrived on. */
interface GraphqlRequestContext {
    /** The HTTP request. */
    readonly req: Request
}

/** The HTTP request behind an execution context, whether the door is a REST controller or a GraphQL resolver. */
export const requestOf = (context: ExecutionContext): Request =>
    context.getType<string>() === "graphql"
        ? GqlExecutionContext.create(context).getContext<GraphqlRequestContext>().req
        : context.switchToHttp().getRequest<Request>()
