import type { ExecutionContext } from "@nestjs/common"
import type { Request } from "express"

/** The HTTP request behind an execution context. */
export const requestOf = (context: ExecutionContext): Request => context.switchToHttp().getRequest<Request>()
