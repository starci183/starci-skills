import type { ExecutionContext } from "@nestjs/common"
import { GqlExecutionContext } from "@nestjs/graphql"
import type { Request } from "express"

/** The GraphQL context the Apollo driver builds: the HTTP request the operation arrived on. */
interface GraphqlRequestContext {
    readonly req: Request
}

/** The HTTP request behind an execution context, whether the door is a REST controller or a GraphQL resolver. */
export const requestOf = (context: ExecutionContext): Request =>
    context.getType<string>() === "graphql"
        ? GqlExecutionContext.create(context).getContext<GraphqlRequestContext>().req
        : context.switchToHttp().getRequest<Request>()
