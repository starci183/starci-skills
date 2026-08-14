import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { identityNeedsGuard } from "./authorization.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: false } },
  },
})
const RESOLVER = "D:/repo/src/features/api/core/graphql/mutations/courses/x/x.resolver.ts"

test("AUTHZ-2: a door reading the identity carries the guard that establishes it", () => {
  tester.run("identity-needs-guard", identityNeedsGuard, {
    valid: [
      // the ordinary shape: the guard sits on the method that reads the user
      {
        filename: RESOLVER,
        code: [
          "class R {",
          "  @UseGuards(KeycloakAuthGraphQLGuard)",
          "  @Mutation(() => Res)",
          "  async execute(@KeycloakGraphQLUser() user: UserEntity) { return user }",
          "}",
        ].join("\n"),
      },
      // the guard on the CLASS covers every method on it - refusing this would push authors to
      // repeat the decorator per method, which is not what the tree does
      {
        filename: RESOLVER,
        code: [
          "@UseGuards(KeycloakAuthGraphQLGuard)",
          "class R {",
          "  async execute(@KeycloakGraphQLUser() user: UserEntity) { return user }",
          "}",
        ].join("\n"),
      },
      // a door that reads NO identity needs no guard from this rule - a public query is not a
      // finding, and treating it as one is how a rule gets disabled wholesale
      {
        filename: RESOLVER,
        code: [
          "class R {",
          "  @Query(() => Res)",
          "  async execute(@Args('request') request: Req) { return request }",
          "}",
        ].join("\n"),
      },
    ],
    invalid: [
      // the failure that looks like nothing: the parameter still says `user`
      {
        filename: RESOLVER,
        code: [
          "class R {",
          "  @Mutation(() => Res)",
          "  async execute(@KeycloakGraphQLUser() user: UserEntity) { return user }",
          "}",
        ].join("\n"),
        errors: [{ messageId: "unguarded" }],
      },
      // an interceptor is not a guard, and it is the decorator most likely to be mistaken for one
      // because it sits in the same stack and reads the same way
      {
        filename: RESOLVER,
        code: [
          "class R {",
          "  @UseInterceptors(GraphQLTransformInterceptor)",
          "  @Mutation(() => Res)",
          "  async execute(@KeycloakGraphQLUser() user: UserEntity) { return user }",
          "}",
        ].join("\n"),
        errors: [{ messageId: "unguarded" }],
      },
      // a second door name for the same identity: aliasing the decorator does not walk past it
      {
        filename: RESOLVER,
        code: [
          "class R {",
          "  async execute(@CurrentUser() user: UserEntity) { return user }",
          "}",
        ].join("\n"),
        errors: [{ messageId: "unguarded" }],
      },
    ],
  })
})
