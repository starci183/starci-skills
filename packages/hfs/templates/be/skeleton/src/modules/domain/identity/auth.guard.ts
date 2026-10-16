import { Injectable } from "@nestjs/common"
import type { CanActivate, ExecutionContext } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import { InjectReflector } from "@modules/platform/composition"
import { requestOf } from "@modules/platform/http-security"
import { unwrapOutcome } from "@modules/platform/primitives"
import { admit } from "./admission.policy"
import type { CredentialMetadata } from "./credential.contracts"
import { IdentityError } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { CREDENTIAL_KEY, PUBLIC_KEY } from "./identity.decorators"

@Injectable()
/**
 * The fourth app guard and the default-deny gate: a door is open only when it says `@Public({ reason })`, or when it is
 * marked `@Credential` and `CredentialGuard` has set the credential principal. It never calls another guard.
 */
export class AuthGuard implements CanActivate {
    constructor(@InjectReflector() private readonly reflector: Reflector) {}

    /** Lets public and credential-authenticated doors through and refuses every other door. */
    canActivate(context: ExecutionContext): boolean {
        const targets = [context.getHandler(), context.getClass()]
        const required = this.reflector.getAllAndOverride<CredentialMetadata | undefined>(CREDENTIAL_KEY, targets)
        const metadata = this.reflector.getAllAndOverride<PublicMetadata | undefined>(PUBLIC_KEY, targets)
        const credential =
            required === undefined ? undefined : { required, principal: requestOf(context).credentialPrincipal }
        unwrapOutcome(admit(metadata, credential), IdentityError)
        return true
    }
}
