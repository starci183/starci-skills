/** R85 proves every shipped injection boundary in both application editions. */
// proves: BE_RAW_INJECT@lite
// proves: BE_RAW_INJECT@full
import assert from "node:assert/strict"
import test from "node:test"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { rules as graphRules } from "./project-graph.mjs"
import { providerParamToken } from "./service-deps.mjs"
import {
    infraNeedsInjector,
    injectedParamName,
    injectorOnly,
    injectorShape,
    injectorTypeMatch,
    noForwardRef,
    noModuleRef,
    noStringToken,
} from "./injection.mjs"

const SERVICE = at("src/modules/domain/order/order.consumer.ts")
const DECORATORS = at("src/modules/platform/clock/probe.decorators.ts")
const CLOCK = 'import { InjectClock, type Clock } from "@modules/platform/clock"\n'
const INJECTABLE = 'import { Injectable } from "@nestjs/common"\n'
const SHAPE = `import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { Clock } from "@modules/platform/clock"
export const CLOCK: unique symbol = Symbol("platform.clock")
/** Injects the Clock port. Parameter type: Clock. */
`

for (const edition of ["lite", "full"]) {
    test(`R85 accepts valid owner injectors and rejects raw injection in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        const tester = ruleTester({ root: TYPED_ROOT, hfs })
        tester.run("injector-only", injectorOnly, {
            valid: [{ filename: SERVICE, code: `${CLOCK}export class Consumer { constructor(@InjectClock() private readonly clock: Clock) {} }` }],
            invalid: [{
                filename: SERVICE,
                code: 'import { Inject } from "@nestjs/common"; const TOKEN: unique symbol = Symbol("order.clock"); export class Consumer { constructor(@Inject(TOKEN) private readonly clock: object) {} }',
                errors: [{ messageId: "rawDecorator" }],
            }],
        })
        tester.run("injector-shape", injectorShape, {
            valid: [{ filename: DECORATORS, code: `${SHAPE}export const InjectClock = (): TypedParameterDecorator<Clock> => injector<Clock>(CLOCK)` }],
            invalid: [{
                filename: DECORATORS,
                code: `${SHAPE}export const InjectClock = (key: string): TypedParameterDecorator<Clock> => injector<Clock>(CLOCK)`,
                errors: [{ messageId: "params" }],
            }],
        })
        tester.run("injector-type-match", injectorTypeMatch, {
            valid: [{ filename: SERVICE, code: `${CLOCK}export class Consumer { constructor(@InjectClock() private readonly clock: Clock) {} }` }],
            invalid: [{
                filename: SERVICE,
                code: `${CLOCK}import type { Logger } from "@modules/platform/logging"; export class Consumer { constructor(@InjectClock() private readonly clock: Logger) {} }`,
                errors: [{ messageId: "mismatch" }],
            }],
        })
        tester.run("infra-needs-injector", infraNeedsInjector, {
            valid: [{ filename: SERVICE, code: `${INJECTABLE}${CLOCK}@Injectable() export class Consumer { constructor(@InjectClock() private readonly clock: Clock) {} }` }],
            invalid: [{
                filename: SERVICE,
                code: `${INJECTABLE}${CLOCK}@Injectable() export class Consumer { constructor(private readonly clock: Clock) {} }`,
                errors: [{ messageId: "missing" }],
            }],
        })
        tester.run("injected-param-name", injectedParamName, {
            valid: [{ filename: SERVICE, code: `${INJECTABLE}${CLOCK}@Injectable() export class Consumer { constructor(@InjectClock() private readonly clock: Clock) {} }` }],
            invalid: [{
                filename: SERVICE,
                code: `${INJECTABLE}${CLOCK}@Injectable() export class Consumer { constructor(@InjectClock() private readonly time: Clock) {} }`,
                errors: [{ messageId: "name" }],
            }],
        })
        tester.run("provider-param-token", providerParamToken, {
            valid: [{ filename: SERVICE, code: `${INJECTABLE}${CLOCK}@Injectable() export class Consumer { constructor(@InjectClock() private readonly clock: Clock) {} }` }],
            invalid: [{
                filename: SERVICE,
                code: `${INJECTABLE}@Injectable() export class Consumer { constructor(private readonly timeoutMs: number) {} }`,
                errors: [{ messageId: "untokened" }],
            }],
        })
        tester.run("no-module-ref", noModuleRef, {
            valid: [{ filename: SERVICE, code: 'import { Reflector } from "@nestjs/core"; export const reflection = Reflector' }],
            invalid: [{ filename: SERVICE, code: 'import { ModuleRef } from "@nestjs/core"; export const marker = 1', errors: [{ messageId: "use" }] }],
        })
        tester.run("no-forward-ref", noForwardRef, {
            valid: [{ filename: SERVICE, code: 'export const later = (): number => 1' }],
            invalid: [{ filename: SERVICE, code: 'import { forwardRef } from "@nestjs/common"; export const later = forwardRef(() => 1)', errors: [{ messageId: "cycle" }] }],
        })
        tester.run("no-string-token", noStringToken, {
            valid: [{ filename: SERVICE, code: 'const TOKEN: unique symbol = Symbol("order.clock"); export const providers = [{ provide: TOKEN, useValue: 1 }]' }],
            invalid: [{ filename: SERVICE, code: 'export const providers = [{ provide: "CLOCK", useValue: 1 }]', errors: [{ messageId: "string" }] }],
        })
    })
    test(`R85 accepts exported injection tokens and rejects private tokens in ${edition}`, (t) => {
        const goodDecorator = "src/modules/domain/good/cart.decorators.ts"
        const badDecorator = "src/modules/domain/private/cart.decorators.ts"
        const token = "const CLOCK: unique symbol = Symbol('platform.clock');\n"
        const build = "declare function injector(token: unknown): unknown;\n"
        const inject = "export const InjectClock = () => injector(CLOCK);\n"
        const service = "import { InjectClock } from './cart.decorators'; export class CartService { constructor(@InjectClock() private readonly clock: object) {} }\n"
        const files = {
            [goodDecorator]: `${build}export ${token}${inject}`,
            [badDecorator]: `${build}${token}${inject}`,
            "src/modules/domain/good/cart.service.ts": service,
            "src/modules/domain/private/cart.service.ts": service,
            "src/modules/domain/good/index.ts": "export { CartService } from './cart.service'; export { CLOCK } from './cart.decorators';\n",
            "src/modules/domain/private/index.ts": "export { CartService } from './cart.service';\n",
        }
        const fixture = projectFixture({ edition, files })
        t.after(fixture.cleanup)
        fixture.tester.run("injection-token-exported", graphRules["injection-token-exported"], {
            valid: [{ filename: fixture.at(goodDecorator), code: files[goodDecorator] }],
            invalid: [{ filename: fixture.at(badDecorator), code: files[badDecorator], errors: [{ message: /BE_RAW_INJECT/ }] }],
        })
    })
}
