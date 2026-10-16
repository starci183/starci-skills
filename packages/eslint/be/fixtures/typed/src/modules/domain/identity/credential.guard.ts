import type { CanActivate, ExecutionContext } from "@nestjs/common"

/** Fixture: the canon credential guard, authenticating the kind a route declares with `@Credential`. */
export class CredentialGuard implements CanActivate {
    /** Fixture: admits every call. */
    canActivate(_context: ExecutionContext): boolean {
        return true
    }
}
