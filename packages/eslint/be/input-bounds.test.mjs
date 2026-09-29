/**
 * Twin tests for the input-bounds rule.
 *
 *   node --test input-bounds.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { dtoNeedsValidator, rules } from "./input-bounds.mjs"

const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const REQUEST = "D:/repo/src/features/plan/transport/http/dto/create-plan.request.ts"
const SERVICE = "D:/repo/src/modules/domain/plan/plan.service.ts"
const SPEC = "D:/repo/src/features/plan/transport/http/dto/create-plan.request.spec.ts"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("R42: every property of an input class carries a class-validator decorator", () => {
  tester.run("dto-needs-validator", dtoNeedsValidator, {
    valid: [
      {
        filename: REQUEST,
        code: "import { IsString, MaxLength } from 'class-validator'\nexport class CreatePlanRequest { @IsString() @MaxLength(80) name: string }",
      },
      {
        filename: REQUEST,
        code: "import { IsOptional, IsInt, Min } from 'class-validator'\nexport class ListPlansRequest { @IsOptional() @IsInt() @Min(0) offset?: number }",
      },
      // a validator imported under an alias still counts
      {
        filename: REQUEST,
        code: "import { IsString as Str } from 'class-validator'\nexport class CreatePlanRequest { @Str() name: string }",
      },
      // a GraphQL input is judged by its decorator, in any file
      {
        filename: SERVICE,
        code: "import { IsUUID } from 'class-validator'\n@InputType()\nexport class PlanInput { @Field() @IsUUID() planId: string }",
      },
      // a response type is not input
      { filename: "D:/repo/src/features/plan/transport/http/dto/plan.response.ts", code: "export class PlanResponse { name: string }" },
      { filename: SERVICE, code: "@ObjectType()\nexport class PlanType { @Field() name: string }" },
      // an ordinary class is not input
      { filename: SERVICE, code: "export class PlanService { private name: string }" },
      { filename: SPEC, code: "export class CreatePlanRequest { name: string }" },
    ],
    invalid: [
      {
        filename: REQUEST,
        code: "export class CreatePlanRequest { name: string }",
        errors: [{ messageId: "missing" }],
      },
      {
        filename: REQUEST,
        code: "import { Field } from '@nestjs/graphql'\nexport class CreatePlanRequest { @Field() name: string }",
        errors: [{ messageId: "missing" }],
      },
      {
        filename: SERVICE,
        code: "@InputType()\nexport class PlanInput { @Field() planId: string; @Field() note: string }",
        errors: [{ messageId: "missing" }, { messageId: "missing" }],
      },
      // a class-transformer decorator is not a validator
      {
        filename: REQUEST,
        code: "import { Type } from 'class-transformer'\nexport class CreatePlanRequest { @Type(() => Number) size: number }",
        errors: [{ messageId: "missing" }],
      },
    ],
  })
})
