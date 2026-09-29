import {
    createParamDecorator, ExecutionContext 
} from "@nestjs/common"
import {
    GqlExecutionContext 
} from "@nestjs/graphql"
import {
    SessionInvalidException 
} from "ecommerce-app-be/modules/platform/errors"
import {
    CHECKOUT_MESSAGES 
} from "../../messages/index"

import {
    ActorParams 
} from "./session.guard"

/** The request shape SessionGuard leaves behind: the verified actor stamped on it. */
interface SessionStampedRequest { actor?: ActorParams }

/** The GraphQL context the decorator unwraps: the request SessionGuard already stamped. */
interface SessionActorContext { req?: SessionStampedRequest }

/**
 * Injects the actor SessionGuard verified onto a resolver parameter - the same pattern
 * nivo-backend's `@KeycloakGraphQLUser()` uses: the guard establishes the identity on
 * `context.req.actor`, the decorator reads it. A request that reaches here without an actor is
 * the guarded-request-without-a-person case the retired REST doors refused with
 * SESSION_INVALID, and it refuses the same way.
 */
export const SessionActor = createParamDecorator(
    (_data: unknown,
        context: ExecutionContext): ActorParams => {
        const request = GqlExecutionContext.create(context).getContext<SessionActorContext>().req
        if (!request?.actor) {
            throw new SessionInvalidException({
                message: CHECKOUT_MESSAGES.get("session.noActor") 
            })
        }
        return request.actor
    },
)
