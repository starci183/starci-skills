// proves: BE_CQRS_SHAPE@lite
// proves: BE_CQRS_SHAPE@full
// proves: BE_READONLY_BOUNDARY@lite
// proves: BE_READONLY_BOUNDARY@full
import test from "node:test"
import { appDeclaration } from "./fixtures/app.mjs"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { at, BE_DECLARATION, ruleTester, TYPED_ROOT } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { executeParamsShape, handlerIsThin, handlerOverridesProcess, messageCarriesParamsOnly, messageTypedResult, noEventBus, noUseCase } from "./cqrs.mjs"
import { rules as graphRules } from "./project-graph.mjs"

const APPLICATION = "src/features/api/plan/application"
const COMMAND = at(`${APPLICATION}/place-order.command.ts`)
const HANDLER = at(`${APPLICATION}/place-order.handler.ts`)
const MESSAGE_IMPORTS = `import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
`
const HANDLER_IMPORTS = `import { CommandHandler } from "@nestjs/cqrs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { OrderService } from "@modules/domain/order"
class PlaceOrderCommand { constructor(readonly params: { id: string }) {} }
`

const message = (members = "") => `${MESSAGE_IMPORTS}
export class PlaceOrderCommand extends Command<string> {
    constructor(readonly params: ExecuteParams<{ id: string }>) { super() }
    ${members}
}`

const handler = (body) => `${HANDLER_IMPORTS}
@CommandHandler(PlaceOrderCommand)
class PlaceOrderHandler extends ICQRSHandler<PlaceOrderCommand, string> {
    constructor(private readonly orders: OrderService) { super() }
    protected override async process(command: PlaceOrderCommand): Promise<string> { ${body} }
}`

const ORDER = "src/modules/domain/orders"
const READONLY_COMMAND = `${ORDER}/create-order.command.ts`
const MUTABLE_COMMAND = `${ORDER}/change-order.command.ts`
const READONLY_FILES = {
    "node_modules/@nestjs/cqrs/package.json": '{"name":"@nestjs/cqrs","types":"index.d.ts"}',
    "node_modules/@nestjs/cqrs/index.d.ts": "export declare function CommandHandler(message: unknown): ClassDecorator;",
    [READONLY_COMMAND]: "export class CreateOrderCommand { constructor(public readonly id: string) {} }\n",
    [MUTABLE_COMMAND]: "export class ChangeOrderCommand { constructor(public id: string) {} }\n",
    [`${ORDER}/create-order.handler.ts`]: `import { CommandHandler } from "@nestjs/cqrs"
import { CreateOrderCommand } from "./create-order.command"
@CommandHandler(CreateOrderCommand) export class CreateOrderHandler {}
`,
    [`${ORDER}/change-order.handler.ts`]: `import { CommandHandler } from "@nestjs/cqrs"
import { ChangeOrderCommand } from "./change-order.command"
@CommandHandler(ChangeOrderCommand) export class ChangeOrderHandler {}
`,
}

for (const edition of ["lite", "full"]) {
    const declaration = { ...appDeclaration("be", BE_DECLARATION), edition }
    const tester = ruleTester({ root: TYPED_ROOT, hfs: hfsFromDeclaration(declaration, TYPED_ROOT) })

    test(`${edition} handler-overrides-process accepts the template and rejects an execute override`, () => {
        tester.run("handler-overrides-process", handlerOverridesProcess, {
            valid: [{ filename: HANDLER, code: handler("return this.orders.open(command.params.id)") }],
            invalid: [{
                filename: HANDLER,
                code: `${HANDLER_IMPORTS}
@CommandHandler(PlaceOrderCommand)
class PlaceOrderHandler extends ICQRSHandler<PlaceOrderCommand, string> {
    async execute(command: PlaceOrderCommand): Promise<string> { return command.params.id }
}`,
                errors: [{ messageId: "overridesExecute" }],
            }],
        })
    })

    test(`${edition} handler-is-thin accepts one service call and rejects handler logic`, () => {
        tester.run("handler-is-thin", handlerIsThin, {
            valid: [{ filename: HANDLER, code: handler("return this.orders.open(command.params.id)") }],
            invalid: [{
                filename: HANDLER,
                code: handler("const id = command.params.id; return this.orders.open(id)"),
                errors: [{ messageId: "body" }],
            }],
        })
    })

    test(`${edition} message-carries-params-only accepts one params and rejects message logic`, () => {
        tester.run("message-carries-params-only", messageCarriesParamsOnly, {
            valid: [{ filename: COMMAND, code: message() }],
            invalid: [{ filename: COMMAND, code: message("total() { return 1 }"), errors: [{ messageId: "member" }] }],
        })
    })

    test(`${edition} message-typed-result accepts a result type and rejects an untyped message`, () => {
        tester.run("message-typed-result", messageTypedResult, {
            valid: [{ filename: COMMAND, code: message() }],
            invalid: [{
                filename: COMMAND,
                code: `${MESSAGE_IMPORTS}
export class PlaceOrderCommand extends Command {
    constructor(readonly params: ExecuteParams<{ id: string }>) { super() }
}`,
                errors: [{ messageId: "result" }],
            }],
        })
    })

    test(`${edition} execute-params-shape accepts platform params and rejects a handwritten shape`, () => {
        tester.run("execute-params-shape", executeParamsShape, {
            valid: [{ filename: COMMAND, code: message() }],
            invalid: [{
                filename: COMMAND,
                code: `${MESSAGE_IMPORTS}
export class PlaceOrderCommand extends Command<string> {
    constructor(readonly params: { request: { id: string } }) { super() }
}`,
                errors: [{ messageId: "shape" }],
            }],
        })
    })

    test(`${edition} no-use-case accepts a handler and rejects a use-case file`, () => {
        tester.run("no-use-case", noUseCase, {
            valid: [{ filename: HANDLER, code: handler("return this.orders.open(command.params.id)") }],
            invalid: [{
                filename: at(`${APPLICATION}/place-order.use-case.ts`),
                code: "export const value = 1",
                errors: [{ messageId: "file" }],
            }],
        })
    })

    test(`${edition} no-event-bus accepts command imports and rejects in-process events`, () => {
        tester.run("no-event-bus", noEventBus, {
            valid: [{ filename: HANDLER, code: 'import { CommandBus } from "@nestjs/cqrs"; export const bus = CommandBus' }],
            invalid: [{
                filename: HANDLER,
                code: 'import { EventBus } from "@nestjs/cqrs"; export const bus = EventBus',
                errors: [{ messageId: "event" }],
            }],
        })
    })

    test(`${edition} readonly-boundary accepts readonly messages and rejects mutable messages`, (t) => {
        const fixture = projectFixture({ files: READONLY_FILES, edition })
        t.after(fixture.cleanup)
        fixture.tester.run("readonly-boundary", graphRules["readonly-boundary"], {
            valid: [{ filename: fixture.at(READONLY_COMMAND), code: READONLY_FILES[READONLY_COMMAND] }],
            invalid: [{
                filename: fixture.at(MUTABLE_COMMAND),
                code: READONLY_FILES[MUTABLE_COMMAND],
                errors: [{ message: /BE_READONLY_BOUNDARY/, line: 1 }],
            }],
        })
    })
}
