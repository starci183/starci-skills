import { Module } from "@nestjs/common"
import { GetAccountHandler } from "./application/get-account.handler"
import { RegisterHandler } from "./application/register.handler"
import { RevokeSessionHandler } from "./application/revoke-session.handler"
import { SignInHandler } from "./application/sign-in.handler"
import { VerifySessionHandler } from "./application/verify-session.handler"

@Module({
    providers: [RegisterHandler, SignInHandler, VerifySessionHandler, RevokeSessionHandler, GetAccountHandler],
})
/** The identity feature: the handlers of registration, sign-in, session verification and revocation, and the account read. */
export class IdentityModule {}
