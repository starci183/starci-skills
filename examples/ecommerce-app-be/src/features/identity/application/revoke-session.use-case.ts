import {
    Injectable
} from "@nestjs/common"
import {
    SessionService
} from "ecommerce-app-be/modules/domain/session"
import {
    RequestInvalidException
} from "ecommerce-app-be/modules/platform/errors"

@Injectable()
/**
 * Revoke one presented bearer token. A missing or untyped token is refused as REQUEST_INVALID
 * before the session store is touched.
 */
export class RevokeSessionUseCase {
    constructor(private readonly sessions: SessionService) {}

    async execute(sessionToken: unknown): Promise<{ revoked: true }> {
        const token = typeof sessionToken === "string" ? sessionToken : ""
        if (!token) {
            throw new RequestInvalidException({
                message: "sessionToken is required."
            })
        }
        await this.sessions.revoke(token)
        return {
            revoked: true
        }
    }
}
