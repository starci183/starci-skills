import {
    Injectable
} from "@nestjs/common"
import {
    SessionService
} from "ecommerce-app-be/modules/domain/session"
import {
    SessionInvalidException
} from "ecommerce-app-be/modules/platform/errors"
import {
    IDENTITY_MESSAGES 
} from "../messages/index"

/** The person a live session belongs to. */
export interface VerifiedSessionResult {
  personId: string;
}

@Injectable()
/**
 * Verify one presented bearer token: an untyped or empty token verifies as the empty token (never
 * a crash), and a token no live session answers is a typed SESSION_INVALID refusal, never a
 * silent null the caller could mistake for an anonymous person.
 */
export class VerifySessionUseCase {
    constructor(private readonly sessions: SessionService) {}

    async execute(sessionToken: unknown): Promise<VerifiedSessionResult> {
        const token = typeof sessionToken === "string" ? sessionToken : ""
        const personId = await this.sessions.verify(token)
        if (!personId) {
            throw new SessionInvalidException({
                message: IDENTITY_MESSAGES.get("session.noLiveSession")
            })
        }
        return {
            personId
        }
    }
}
