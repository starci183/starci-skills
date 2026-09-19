import {
    Body, Controller, Post, UseFilters 
} from "@nestjs/common"
import {
    SessionService 
} from "@modules/bussiness/session/session.service"
import {
    SessionInvalidException 
} from "@modules/platform/exceptions/errors/sessions/session-invalid"
import {
    RequestInvalidException 
} from "@modules/platform/exceptions/errors/requests/request-invalid"
import {
    BusinessCodeExceptionFilter 
} from "./business-code.filter"

/** The session-token payload the verify/revoke doors receive; the token arrives untyped. */
export interface VerifySessionParams {
  sessionToken?: unknown;
}

@Controller("internal/sessions")
@UseFilters(BusinessCodeExceptionFilter)
/**
 * The session surface the order service calls (its integrations/identity client) - an internal
 * machine door, no user session to carry: the bearer token travels in a JSON body on an internal
 * route, and the answer is only ever the person behind a live session - or a typed 401 the
 * consumer propagates as its own refusal. The filter keeps the wire code at the business code
 * (`SESSION_INVALID`, `REQUEST_INVALID`) the GraphQL doors also stamp - the `_EXCEPTION` suffix
 * is the exception class's internal name, not part of the contract.
 */
export class SessionController {
    constructor(private readonly sessions: SessionService) {}

  @Post("verify")
    async verify(@Body() body: VerifySessionParams): Promise<{ personId: string }> {
        const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken : ""
        const personId = await this.sessions.verify(sessionToken)
        if (!personId) {
            throw new SessionInvalidException({
                message: "No live session answers this token." 
            })
        }
        return {
            personId 
        }
    }

  @Post("revoke")
  async revoke(@Body() body: VerifySessionParams): Promise<{ revoked: true }> {
      const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken : ""
      if (!sessionToken) {
          throw new RequestInvalidException({
              message: "sessionToken is required." 
          })
      }
      await this.sessions.revoke(sessionToken)
      return {
          revoked: true 
      }
  }
}
