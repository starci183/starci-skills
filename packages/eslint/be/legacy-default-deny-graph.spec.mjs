// proves: BE_DEFAULT_DENY@lite BE_DEFAULT_DENY@full
import test from "node:test"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

const appModule = (guards) => [
    'import { Module } from "@nestjs/common"',
    'import { APP_GUARD } from "@nestjs/core"',
    'import { ThrottlerGuard } from "@nestjs/throttler"',
    'import { CsrfOriginGuard } from "../../../src/modules/platform/http-security"',
    'import { AuthGuard, CredentialGuard } from "../../../src/modules/domain/identity"',
    "@Module({ providers: [" + guards.map((name) => "{ provide: APP_GUARD, useClass: " + name + " }").join(", ") + "] })",
    "export class AppModule {}",
    "",
].join("\n")
const VALID = appModule(["ThrottlerGuard", "CsrfOriginGuard", "CredentialGuard", "AuthGuard"])
const INVALID = appModule(["ThrottlerGuard", "CsrfOriginGuard", "CredentialGuard"])

for (const edition of ["lite", "full"]) {
    test(`R41 app guard valid and invalid cases in ${edition}`, (t) => {
        const fixture = projectFixture({
            edition,
            apps: [{ name: "core", kind: "api" }, { name: "unguarded", kind: "api" }],
            files: {
                "src/modules/platform/http-security/index.ts": 'export { CsrfOriginGuard } from "./csrf-origin.guard"\n',
                "src/modules/platform/http-security/csrf-origin.guard.ts": "export class CsrfOriginGuard { canActivate(context: { headers: { origin?: string } }): boolean { return context.headers.origin !== undefined } }\n",
                "src/modules/domain/identity/index.ts": 'export { AuthGuard } from "./auth.guard"\nexport { CredentialGuard } from "./credential.guard"\n',
                "src/modules/domain/identity/credential.guard.ts": "export class CredentialGuard { canActivate(): boolean { return true } }\n",
                "src/modules/domain/identity/auth.guard.ts": "export class AuthGuard { canActivate(): boolean { return true } }\n",
                "apps/core/src/app.module.ts": VALID,
                "apps/unguarded/src/app.module.ts": INVALID,
                "apps/unguarded/src/main.ts": "void 0\n",
            },
        })
        t.after(fixture.cleanup)
        fixture.tester.run("default-deny-app-guard", rules["default-deny-app-guard"], {
            valid: [{ filename: fixture.at("apps/core/src/app.module.ts"), code: VALID }],
            invalid: [{ filename: fixture.at("apps/unguarded/src/app.module.ts"), code: INVALID, errors: [{ messageId: "finding" }] }],
        })
    })
}
