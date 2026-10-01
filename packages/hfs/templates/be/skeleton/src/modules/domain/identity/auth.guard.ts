import { Injectable } from "@nestjs/common"
import type { CanActivate, ExecutionContext } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import { InjectReflector } from "@modules/platform/composition"
import { unwrapOutcome } from "@modules/platform/primitives"
import { admit } from "./admission.policy"
import { IdentityError } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { PUBLIC_KEY } from "./identity.decorators"

@Injectable()
/** The third app guard and the default-deny gate: a door is open only when it says `@Public({ reason })`. */
export class AuthGuard implements CanActivate {
    constructor(@InjectReflector() private readonly reflector: Reflector) {}

    /** Lets public doors through and refuses every other door. */
    canActivate(context: ExecutionContext): boolean {
        const metadata = this.reflector.getAllAndOverride<PublicMetadata | undefined>(PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ])
        unwrapOutcome(admit(metadata), IdentityError)
        return true
    }
}
