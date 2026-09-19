import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { restDoorNeedsAReason, doorLivesInFeatures, noCapabilityImportsFeatures } from "./transport.mjs"

const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const DOOR = "D:/repo/src/features/core/api/core/http/x/x.controller.ts"

test("a REST door has to show why it is not GraphQL", () => {
  tester.run("rest-door-needs-a-reason", restDoorNeedsAReason, {
    valid: [
      // an external system posting to a URL we gave it
      { filename: DOOR, code: '@Controller("webhooks/sepay") class X {}' },
      // the route is silent but the FILE says webhook, which is the same fact
      {
        filename: "D:/repo/src/features/core/api/core/http/payment/payment-webhook.controller.ts",
        code: '@Controller("api/payment") class X {}',
      },
      // bytes rather than fields
      {
        filename: DOOR,
        code: '@Controller("api/media") class X { @Post() up(@UploadedFile() f) {} }\nconst i = FileInterceptor("file")',
      },
      { filename: DOOR, code: '@Controller("api/media") class X { get(@Res() res) {} }' },
      // a machine registering itself
      { filename: DOOR, code: '@Controller("pods/self") class X {}' },
      // an identity that is not a user session
      { filename: DOOR, code: '@Controller("api/ops/lifecycle") class X {}' },
      {
        filename: DOOR,
        code: '@Controller("api/fleet") class X {}\nconst g = PlatformOperatorHttpGuard',
      },
      // a probe, by route and by address
      { filename: DOOR, code: '@Controller("health") class X {}' },
      {
        filename: "D:/repo/apps/core/src/health/healthz.controller.ts",
        code: "@Controller() class X {}",
      },
      // a GraphQL door is not this rule's business at all
      { filename: DOOR, code: "@Resolver() class X {}" },
    ],
    invalid: [
      // an argument-free JSON read, which is a GraphQL query wearing a REST coat
      {
        filename: DOOR,
        code: '@Controller("api/gpus") class X { @Get() list() { return { gpus: [] } } }',
        errors: [{ messageId: "unjustified" }],
      },
      {
        filename: DOOR,
        code: '@Controller("api/theme") class X { @Get() get() { return buildTheme() } }',
        errors: [{ messageId: "unjustified" }],
      },
      // `@Controller()` with no route and no probe in its address shows nothing either
      {
        filename: DOOR,
        code: "@Controller() class X {}",
        errors: [{ messageId: "unjustified" }],
      },
    ],
  })
})

test("a door lives under features, whatever its transport", () => {
  tester.run("door-lives-in-features", doorLivesInFeatures, {
    valid: [
      { filename: DOOR, code: '@Controller("api/ops") class X {}' },
      // a separate application assembles its own doors and is not subject to this split
      {
        filename: "D:/repo/apps/agentos-controlplane/src/leads/leads.controller.ts",
        code: '@Controller("leads") class X {}',
      },
      // a capability may hold anything else it likes
      {
        filename: "D:/repo/src/modules/bussiness/theme/build-theme.ts",
        code: "export const buildTheme = () => ({})",
      },
    ],
    invalid: [
      {
        filename: "D:/repo/src/modules/bussiness/theme/theme.controller.ts",
        code: '@Controller("api/theme") class X {}',
        errors: [{ messageId: "wrongTree" }],
      },
    ],
  })
})

const CAPABILITY = "D:/repo/src/modules/bussiness/theme/build-theme.ts"

test("a capability under modules/ never imports back into features/", () => {
  tester.run("no-capability-imports-features", noCapabilityImportsFeatures, {
    valid: [
      // a capability calling another capability is the whole shape of modules/
      { filename: CAPABILITY, code: 'import { AiService } from "@modules/ai"' },
      // relative, inside the same capability
      { filename: CAPABILITY, code: 'import { helper } from "./helpers"' },
      // a door importing a capability is the sanctioned direction, and not this rule's business
      { filename: DOOR, code: 'import { ThemeService } from "@modules/bussiness/theme"' },
      // this rule is scoped to files under modules/, not to what a door imports
      { filename: DOOR, code: 'import { X } from "@features/api/core/graphql/other/other.resolver"' },
    ],
    invalid: [
      {
        filename: CAPABILITY,
        code: 'import { ThemeResolver } from "@features/api/core/graphql/theme/theme.resolver"',
        errors: [{ messageId: "reversed" }],
      },
      {
        // no alias, but the path still climbs into features/
        filename: CAPABILITY,
        code: 'import { X } from "../../../features/api/core/graphql/theme/theme.resolver"',
        errors: [{ messageId: "reversed" }],
      },
    ],
  })
})
