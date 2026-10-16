// proves: BE_SPEC_QUALITY@lite
// proves: BE_SPEC_QUALITY@full
import test from "node:test"
import { BE_DECLARATION, TYPED_ROOT, at, typedTester } from "./fixtures/typed/tester.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { rules as graphRules } from "./project-graph.mjs"
import { specTypedEntityManager } from "./spec-quality.mjs"
import { specNoSkip } from "./spec-no-skip.mjs"
import {
    noReturnOnlyGeneric,
    specBuildsWithTestingModule,
    specExactValues,
    specInfraDoubleFromKit,
    specModuleDefinitionOnlyProviders,
    specNoModuleMock,
    specNoNewSubject,
} from "./unit-spec.mjs"

const tester = typedTester()
const SPEC = at("src/modules/domain/order/order.service.spec.ts")
const NEST = 'import { Test } from "@nestjs/testing"\nimport { OrderService } from "./order.service"\n'
const BUILT = `${NEST}it("returns the exact result", async () => {
    const moduleRef = await Test.createTestingModule({ providers: [OrderService] }).compile()
    const service = moduleRef.get(OrderService)
    expect(service.run()).toEqual({ accepted: true })
})`
const DECORATORS = [
    "declare function injector(token: unknown): unknown;",
    "export const CLOCK: unique symbol = Symbol('platform.clock');",
    "export const InjectClock = () => injector(CLOCK);",
    "export const CACHE: unique symbol = Symbol('integrations.cache');",
    "export const InjectCache = () => injector(CACHE);",
].join("\n")
const SERVICE = [
    "import { InjectCache, InjectClock } from './cart.decorators';",
    "import { PriceService } from './price.service';",
    "export class CartService {",
    "  constructor(@InjectClock() private readonly clock: object, @InjectCache() private readonly cache: object, private readonly prices: PriceService) {}",
    "}",
].join("\n")
const providerSpec = (providers) => [
    "import { Test } from '@nestjs/testing';",
    "import { CartService } from './cart.service';",
    "import { PriceService } from './price.service';",
    "import { CACHE as CACHE_TOKEN, CLOCK } from './cart.decorators';",
    "it('builds', async () => {",
    `  await Test.createTestingModule({ providers: [${providers}] }).compile();`,
    "});",
].join("\n")
const capability = (name, providers) => ({
    [`src/modules/domain/${name}/index.ts`]: "export { CartService } from './cart.service';\nexport { CLOCK, CACHE } from './cart.decorators';\n",
    [`src/modules/domain/${name}/cart.decorators.ts`]: DECORATORS,
    [`src/modules/domain/${name}/cart.service.ts`]: SERVICE,
    [`src/modules/domain/${name}/price.service.ts`]: "export class PriceService {}\n",
    [`src/modules/domain/${name}/cart.service.spec.ts`]: providerSpec(providers),
})

for (const edition of ["lite", "full"]) {
    const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
    const settings = { starci: { hfs } }

    test(`R48 ${edition}: a unit subject comes from a compiled Nest testing module`, () => {
        tester.run("spec-builds-with-testing-module", specBuildsWithTestingModule, {
            valid: [{ filename: SPEC, settings, code: BUILT }],
            invalid: [{ filename: SPEC, settings, code: `${NEST}Test.createTestingModule({ providers: [OrderService] })`, errors: [{ messageId: "noCompile" }] }],
        })
    })

    test(`R48 ${edition}: a unit spec does not construct its subject by hand`, () => {
        tester.run("spec-no-new-subject", specNoNewSubject, {
            valid: [{ filename: SPEC, settings, code: BUILT }],
            invalid: [{ filename: SPEC, settings, code: 'import { OrderService } from "./order.service"\nexport const service = new OrderService()', errors: [{ messageId: "construct" }] }],
        })
    })

    test(`R48 ${edition}: a unit testing module declares providers without importing modules`, () => {
        tester.run("spec-module-definition-only-providers", specModuleDefinitionOnlyProviders, {
            valid: [{ filename: SPEC, settings, code: BUILT }],
            invalid: [{ filename: SPEC, settings, code: `${NEST}Test.createTestingModule({ imports: [OrderService], providers: [] })`, errors: [{ messageId: "imports" }] }],
        })
    })

    test(`R48 ${edition}: a unit spec provides collaborators instead of mocking their modules`, () => {
        tester.run("spec-no-module-mock", specNoModuleMock, {
            valid: [{ filename: SPEC, settings, code: 'import { jest } from "@jest/globals"\njest.fn()' }],
            invalid: [{ filename: SPEC, settings, code: 'import { jest } from "@jest/globals"\njest.mock("./order.repository")', errors: [{ messageId: "moduleMock" }] }],
        })
    })

    test(`R48 ${edition}: generic fixture results are driven by an input type`, () => {
        tester.run("no-return-only-generic", noReturnOnlyGeneric, {
            valid: [{ filename: SPEC, settings, code: "export const first = <T>(items: ReadonlyArray<T>): T => items[0]" }],
            invalid: [{ filename: SPEC, settings, code: "export const cast = <T>(value: unknown): T => value as T", errors: [{ messageId: "returnOnly" }] }],
        })
    })

    test(`R48 ${edition}: a clock provider uses the deterministic kit double`, () => {
        tester.run("spec-infra-double-from-kit", specInfraDoubleFromKit, {
            valid: [{ filename: SPEC, settings, code: 'import { FakeClock } from "@starci/jest-preset"\nexport const provider = { provide: "CLOCK", useValue: new FakeClock(0) }' }],
            invalid: [{ filename: SPEC, settings, code: 'export const provider = { provide: "CLOCK", useValue: { now: () => new Date(0) } }', errors: [{ messageId: "wrong" }] }],
        })
    })

    test(`R48 ${edition}: unit assertions name the exact generated identifier`, () => {
        tester.run("spec-exact-values", specExactValues, {
            valid: [{ filename: SPEC, settings, code: 'expect(saved).toEqual({ id: "order-1" })' }],
            invalid: [{ filename: SPEC, settings, code: "expect(saved).toEqual({ id: expect.any(String) })", errors: [{ messageId: "loose" }] }],
        })
    })

    test(`R48 ${edition}: entity-manager doubles come from the typed kit`, () => {
        tester.run("spec-typed-entity-manager", specTypedEntityManager, {
            valid: [{ filename: SPEC, settings, code: 'import { mockEntityManager, fakeTransaction } from "@starci/jest-preset"\nconst manager = mockEntityManager()\nexport const transaction = fakeTransaction(manager)' }],
            invalid: [{ filename: SPEC, settings, code: 'import { mock } from "@starci/jest-preset"\nimport type { EntityManager } from "typeorm"\nexport const manager = mock<EntityManager>()', errors: [{ messageId: "adhoc" }] }],
        })
    })

    test(`R48 ${edition}: every declared unit test runs`, () => {
        tester.run("spec-no-skip", specNoSkip, {
            valid: [{ filename: SPEC, settings, code: 'it("returns the result", () => { expect(1).toBe(1) })' }],
            invalid: [{ filename: SPEC, settings, code: 'it.skip("returns the result", () => { expect(1).toBe(1) })', errors: [{ messageId: "skip" }] }],
        })
    })

    test(`R48 ${edition}: unit providers match every constructor dependency`, (t) => {
        const files = {
            ...capability("provided", "CartService, { provide: CLOCK, useValue: {} }, { provide: CACHE_TOKEN, useValue: {} }, PriceService"),
            ...capability("missing", "CartService, { provide: CLOCK, useValue: {} }, PriceService"),
        }
        const fixture = projectFixture({ edition, files })
        t.after(fixture.cleanup)
        const passing = "src/modules/domain/provided/cart.service.spec.ts"
        const violating = "src/modules/domain/missing/cart.service.spec.ts"
        fixture.tester.run("unit-spec-providers", graphRules["unit-spec-providers"], {
            valid: [{ filename: fixture.at(passing), code: files[passing] }],
            invalid: [{ filename: fixture.at(violating), code: files[violating], errors: [{ messageId: "finding" }] }],
        })
    })
}
