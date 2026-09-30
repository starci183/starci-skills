/**
 * Twin tests for the input-bounds rules (R42).
 *
 *   node --test input-bounds.test.mjs
 *
 * The bound a property owes comes from its TYPE (string, enum, array, nested object), so the cases rename fields freely.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { inputBounded, noOffsetPagination, rules } from "./input-bounds.mjs"

const tester = typedTester()
const REQUEST = at("src/features/plan/transport/http/dto/create-plan.request.ts")
const INPUT = at("src/features/plan/transport/graphql/dto/create-plan.input.ts")
const ARGS = at("src/features/plan/transport/graphql/dto/list-plans.args.ts")
const SERVICE = at("src/modules/domain/plan/plan.service.ts")
const SPEC = at("src/features/plan/transport/http/dto/create-plan.request.spec.ts")

const IMPORTS =
    "import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator'\nimport { Type } from 'class-transformer'\nenum Tier { Free = 'free', Paid = 'paid' }\ninterface Address { street: string }\n"

test("every rule this law declares is exported under its published name", () => {
    for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
    assert.equal("dto-needs-validator" in rules, false, "dto-needs-validator is merged into input-bounded")
})

test("R42: every property of an input class is validated and bounded by its type", () => {
    tester.run("input-bounded", inputBounded, {
        valid: [
            { filename: REQUEST, code: `${IMPORTS}export class CreatePlanRequest { @IsString() @MaxLength(80) name!: string }` },
            { filename: REQUEST, code: `${IMPORTS}export class CreatePlanRequest { @IsOptional() @IsInt() @Min(0) count?: number }` },
            { filename: REQUEST, code: `${IMPORTS}export class CreatePlanRequest { @IsBoolean() flag!: boolean }` },
            { filename: REQUEST, code: `${IMPORTS}export class CreatePlanRequest { @IsEnum(Tier) tier!: Tier }` },
            { filename: REQUEST, code: `${IMPORTS}export class CreatePlanRequest { @IsOptional() @IsEnum(Tier) tier?: Tier }` },
            { filename: REQUEST, code: `${IMPORTS}export class CreatePlanRequest { @IsArray() @ArrayMaxSize(10) ids!: Array<number> }` },
            { filename: REQUEST, code: `${IMPORTS}export class CreatePlanRequest { @ValidateNested() @Type(() => Address) address!: Address }` },
            // a validator imported under an alias still counts
            { filename: REQUEST, code: "import { IsString as Str, MaxLength as Max } from 'class-validator'\nexport class CreatePlanRequest { @Str() @Max(5) name!: string }" },
            // a GraphQL input or args class in a dto folder
            { filename: INPUT, code: `${IMPORTS}export class CreatePlanInput { @IsUUID() @MaxLength(36) planId!: string }` },
            { filename: ARGS, code: `${IMPORTS}export class ListPlansArgs { @IsInt() @Min(1) first!: number }` },
            // a class decorated as an input, in any file
            { filename: SERVICE, code: `${IMPORTS}@InputType()\nexport class PlanInput { @Field() @IsUUID() @MaxLength(36) planId!: string }` },
            // a response type is not input
            { filename: at("src/features/plan/transport/http/dto/plan.response.ts"), code: "export class PlanResponse { name!: string }" },
            { filename: SERVICE, code: "@ObjectType()\nexport class PlanType { @Field() name!: string }" },
            // an ordinary class is not input
            { filename: SERVICE, code: "export class PlanService { private name!: string }" },
            // a file that is not an input file of a transport dto folder is not judged
            { filename: SPEC, code: "export class CreatePlanRequest { name!: string }" },
        ],
        invalid: [
            { filename: REQUEST, code: "export class CreatePlanRequest { name!: string }", errors: [{ messageId: "missing" }] },
            // a decorator that is not from class-validator does not count
            { filename: REQUEST, code: "export class CreatePlanRequest { @Field() @Type(() => String) name!: string }", errors: [{ messageId: "missing" }] },
            { filename: REQUEST, code: `${IMPORTS}export class CreatePlanRequest { @IsString() name!: string }`, errors: [{ messageId: "string" }] },
            // the type decides, not the field name: `title`, `code` and `description` all owe a bound
            { filename: REQUEST, code: `${IMPORTS}export class CreatePlanRequest { @IsString() title!: string; @IsString() code!: string; @IsString() description!: string }`, errors: [{ messageId: "string" }, { messageId: "string" }, { messageId: "string" }] },
            { filename: REQUEST, code: `${IMPORTS}export class CreatePlanRequest { @IsOptional() @IsString() name?: string }`, errors: [{ messageId: "string" }] },
            { filename: REQUEST, code: `${IMPORTS}export class CreatePlanRequest { @IsString() @MaxLength(5) tier!: Tier }`, errors: [{ messageId: "enum" }] },
            { filename: REQUEST, code: `${IMPORTS}export class CreatePlanRequest { @IsArray() ids!: Array<number> }`, errors: [{ messageId: "array" }] },
            { filename: REQUEST, code: `${IMPORTS}export class CreatePlanRequest { @IsArray() ids!: ReadonlyArray<string> }`, errors: [{ messageId: "array" }] },
            { filename: REQUEST, code: `${IMPORTS}export class CreatePlanRequest { @ValidateNested() address!: Address }`, errors: [{ messageId: "nested" }] },
            { filename: REQUEST, code: `${IMPORTS}export class CreatePlanRequest { @Type(() => Address) address!: Address }`, errors: [{ messageId: "missing" }] },
            { filename: INPUT, code: "export class CreatePlanInput { planId!: string }", errors: [{ messageId: "missing" }] },
            { filename: ARGS, code: "export class ListPlansArgs { first!: number }", errors: [{ messageId: "missing" }] },
            { filename: SERVICE, code: "@InputType()\nexport class PlanInput { @Field() planId!: string }", errors: [{ messageId: "missing" }] },
        ],
    })
})

const EM = "import { EntityManager } from 'typeorm'\nclass Plan {}\ndeclare const em: EntityManager\ndeclare const renamed: EntityManager\ndeclare const other: { find(e: unknown, o?: object): void }\ndeclare function sql(s: TemplateStringsArray, ...v: Array<unknown>): unknown\n"

test("R42: reads page by cursor, never by offset", () => {
    tester.run("no-offset-pagination", noOffsetPagination, {
        valid: [
            { filename: SERVICE, code: `${EM}em.find(Plan, { take: 10 })` },
            { filename: SERVICE, code: `${EM}em.query('SELECT id FROM plan WHERE id > $1 ORDER BY id LIMIT $2', [1, 10])` },
            { filename: SERVICE, code: `${EM}sql\`SELECT id FROM plan WHERE id > \${1} ORDER BY id LIMIT 10\`` },
            // a receiver that is not a typeorm EntityManager is not judged, whatever it is called
            { filename: SERVICE, code: `${EM}other.find(Plan, { skip: 5 })` },
            // "offset" as a word inside a comment of ordinary code is not SQL
            { filename: SERVICE, code: "const offsetDays = 3\nexport const x = { offsetDays }" },
            { filename: REQUEST, code: "export class CreatePlanRequest { name!: string }" },
            // a page field outside a transport dto is not a request field
            { filename: SERVICE, code: "export class Window { page!: number }" },
        ],
        invalid: [
            { filename: SERVICE, code: `${EM}em.find(Plan, { skip: 5, take: 10 })`, errors: [{ messageId: "option" }] },
            { filename: SERVICE, code: `${EM}em.find(Plan, { offset: 5 })`, errors: [{ messageId: "option" }] },
            // a renamed receiver is still an EntityManager
            { filename: SERVICE, code: `${EM}renamed.find(Plan, { skip: 5 })`, errors: [{ messageId: "option" }] },
            // options built elsewhere are judged by their type
            { filename: SERVICE, code: `${EM}const options = { skip: 5 }\nem.find(Plan, options)`, errors: [{ messageId: "option" }] },
            // a transaction manager is an EntityManager
            { filename: SERVICE, code: `${EM}em.transaction(async (manager) => manager.find(Plan, { skip: 1 }))`, errors: [{ messageId: "option" }] },
            { filename: SERVICE, code: `${EM}sql\`SELECT id FROM plan ORDER BY id LIMIT 10 OFFSET \${5}\``, errors: [{ messageId: "sql" }] },
            { filename: SERVICE, code: `${EM}em.query('SELECT id FROM plan LIMIT 10 offset 5')`, errors: [{ messageId: "sql" }] },
            { filename: REQUEST, code: "export class ListPlansRequest { page!: number }", errors: [{ messageId: "field" }] },
            { filename: ARGS, code: "export class ListPlansArgs { pageNumber!: number; offset!: number }", errors: [{ messageId: "field" }, { messageId: "field" }] },
            // a spec is not exempt
            { filename: at("src/modules/domain/plan/plan.service.spec.ts"), code: `${EM}em.find(Plan, { skip: 1 })`, errors: [{ messageId: "option" }] },
        ],
    })
})
