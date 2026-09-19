import {
    CanActivate, ExecutionContext, Injectable 
} from "@nestjs/common"
import {
    GqlExecutionContext 
} from "@nestjs/graphql"
import {
    Request 
} from "express"
import {
    IdentityApiClient 
} from "@modules/integrations/identity/identity.client"
import {
    SessionInvalidException 
} from "@modules/platform/exceptions/errors/sessions/session-invalid"

/** The actor a verified request carries - the person the identity service named for the token. */
export interface ActorParams {
  personId: string;
}

/** The GraphQL context shape this guard unwraps: the HTTP request the Apollo driver exposes. */
interface GraphqlContextShape { req?: Request & { actor?: ActorParams } }

@Injectable()
/**
 * Every person-scoped checkout door runs through here: the bearer session token is verified
 * against the identity service over real HTTP (modules/integrations/identity), and the request
 * only proceeds carrying the person that verification named. An absent or refused token is this
 * service's own SESSION_INVALID refusal (the consumer-obligation doctrine: propagate the
 * refusal, never invent an actor); an unreachable identity stays its own typed 503.
 *
 * The guard that sat in front of the retired REST doors now sits in front of the GraphQL
 * resolvers - the request comes out of the GraphQL context the Apollo driver built, and the
 * verify call and its refusals are identical either way.
 */
export class SessionGuard implements CanActivate {
    constructor(private readonly identityApi: IdentityApiClient) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = this.requestOf(context)
        const header = request.headers.authorization ?? ""
        const sessionToken = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : ""
        if (!sessionToken) {
            throw new SessionInvalidException({
                message: "A Bearer session token is required." 
            })
        }
        const verified = await this.identityApi.verifySession(sessionToken)
        if (!verified) {
            throw new SessionInvalidException({
                message: "No live session answers this token." 
            })
        }
        request.actor = {
            personId: verified.personId 
        }
        return true
    }

    /** The underlying HTTP request the GraphQL context carries - the resolvers are the only doors this guard fronts now. */
    private requestOf(context: ExecutionContext): Request & { actor?: ActorParams } {
        const request = GqlExecutionContext.create(context).getContext<GraphqlContextShape>().req
        if (!request) {
            throw new SessionInvalidException({
                message: "GraphQL context carries no HTTP request." 
            })
        }
        return request
    }
}
