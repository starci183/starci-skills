/**
 * Twin tests for the e2e shape rules (HFS R66).
 *
 *   node --test e2e-shape.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  VIEWPORTS,
  e2eNoAbsolutePath,
  e2eNoCrossRepoWrite,
  e2eNoDocker,
  e2eNoSkip,
  e2eSpecLocation,
  e2eTypedHelpers,
  playwrightViewports,
  rules,
  scope,
} from "./e2e-shape.mjs"

const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})

const SPEC = "D:/repo/e2e/course/play.e2e-spec.ts"
const SUPPORT = "D:/repo/e2e/support/session.ts"
const SRC = "D:/repo/src/components/blocks/Feed/index.tsx"

test("every rule this law declares is a rule, and the law names the tree it governs", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  assert.equal(scope, "e2e")
  assert.deepEqual([...VIEWPORTS], ["1440x900", "768x1024", "390x844"])
})

test("E2E-1: a spec is e2e/<area>/<name>.e2e-spec.ts", () => {
  tester.run("e2e-spec-location", e2eSpecLocation, {
    valid: [
      { filename: SPEC, code: "export {}" },
      { filename: SUPPORT, code: "export {}" },
      { filename: "D:/repo/e2e/fixtures/course.ts", code: "export {}" },
      // outside the e2e tree this rule says nothing
      { filename: "D:/repo/src/components/blocks/Feed/index.test.tsx", code: "export {}" },
    ],
    invalid: [
      { filename: "D:/repo/e2e/play.e2e-spec.ts", code: "export {}", errors: [{ messageId: "location" }] },
      { filename: "D:/repo/e2e/course/play.spec.ts", code: "export {}", errors: [{ messageId: "location" }] },
      { filename: "D:/repo/e2e/course/play.test.ts", code: "export {}", errors: [{ messageId: "location" }] },
      { filename: "D:/repo/e2e/course/deep/play.e2e-spec.ts", code: "export {}", errors: [{ messageId: "location" }] },
      { filename: "D:/repo/e2e/support/session.e2e-spec.ts", code: "export {}", errors: [{ messageId: "location" }] },
    ],
  })
})

test("E2E-2: no absolute path", () => {
  tester.run("e2e-no-absolute-path", e2eNoAbsolutePath, {
    valid: [
      { filename: SPEC, code: "const p = path.join(__dirname, \"fixtures\", \"a.png\")" },
      { filename: SPEC, code: "await page.goto(\"/vi/courses\")" },
      { filename: SPEC, code: "await page.goto(\"/courses/basics\")" },
      { filename: SRC, code: "const p = \"C:/Users/me\"" },
    ],
    invalid: [
      { filename: SPEC, code: "const p = \"D:/repos/nivo-backend/out\"", errors: [{ messageId: "absolute" }] },
      { filename: SPEC, code: "const p = \"C:\\\\Users\\\\me\\\\out\"", errors: [{ messageId: "absolute" }] },
      { filename: SUPPORT, code: "const p = \"/Users/me/out\"", errors: [{ messageId: "absolute" }] },
      { filename: SUPPORT, code: "const p = `/home/runner/work`", errors: [{ messageId: "absolute" }] },
    ],
  })
})

test("E2E-3: no docker", () => {
  tester.run("e2e-no-docker", e2eNoDocker, {
    valid: [
      { filename: SPEC, code: "await page.goto(baseUrl)" },
      { filename: SRC, code: "const c = \"docker compose up\"" },
    ],
    invalid: [
      { filename: SUPPORT, code: "execSync(\"docker compose up -d\")", errors: [{ messageId: "docker" }] },
      { filename: SUPPORT, code: "execSync(`docker-compose down`)", errors: [{ messageId: "docker" }] },
      { filename: SUPPORT, code: "import { GenericContainer } from \"testcontainers\"", errors: [{ messageId: "docker" }] },
      { filename: SUPPORT, code: "import Docker from \"dockerode\"", errors: [{ messageId: "docker" }] },
    ],
  })
})

test("E2E-4: no write outside the repository", () => {
  tester.run("e2e-no-cross-repo-write", e2eNoCrossRepoWrite, {
    valid: [
      { filename: SUPPORT, code: "await fs.writeFile(path.join(outDir, \"report.json\"), data)" },
      { filename: SUPPORT, code: "await fs.mkdir(\"test-results/e2e\", { recursive: true })" },
      // reading up the tree is not a write
      { filename: SUPPORT, code: "const s = fs.readFileSync(path.join(__dirname, \"..\", \"fixtures\", \"a.json\"))" },
    ],
    invalid: [
      { filename: SUPPORT, code: "await fs.writeFile(\"../backend/seed.json\", data)", errors: [{ messageId: "write" }] },
      { filename: SUPPORT, code: "fs.writeFileSync(path.join(__dirname, \"..\", \"..\", \"backend\", \"seed.json\"), data)", errors: [{ messageId: "write" }] },
      { filename: SUPPORT, code: "await fs.promises.rm(\"D:/other/tree\", { recursive: true })", errors: [{ messageId: "write" }] },
      { filename: SUPPORT, code: "fs.cpSync(src, \"../shared\")", errors: [{ messageId: "write" }] },
    ],
  })
})

test("E2E-5: no skipped test", () => {
  tester.run("e2e-no-skip", e2eNoSkip, {
    valid: [
      { filename: SPEC, code: "test(\"plays\", async () => {})" },
      { filename: SPEC, code: "test.describe(\"course\", () => {})" },
      { filename: SPEC, code: "test.beforeEach(async () => {})" },
      { filename: "D:/repo/src/x.test.ts", code: "test.skip(\"a\", () => {})" },
    ],
    invalid: [
      { filename: SPEC, code: "test.skip(!process.env.BASE_URL, \"needs env\")", errors: [{ messageId: "skip" }] },
      { filename: SPEC, code: "test.skip(\"plays\", async () => {})", errors: [{ messageId: "skip" }] },
      { filename: SPEC, code: "test.describe.skip(\"course\", () => {})", errors: [{ messageId: "skip" }] },
      { filename: SPEC, code: "it.skip(\"plays\", () => {})", errors: [{ messageId: "skip" }] },
      { filename: SPEC, code: "test.fixme(\"plays\", () => {})", errors: [{ messageId: "skip" }] },
    ],
  })
})

test("E2E-6: helpers are typed and nothing is any", () => {
  tester.run("e2e-typed-helpers", e2eTypedHelpers, {
    valid: [
      { filename: SUPPORT, code: "export const login = async (page: Page, role: Role) => page" },
      { filename: SUPPORT, code: "export function seed(input: SeedInput): void {}" },
      { filename: SUPPORT, code: "export const wait = (ms = 100) => ms" },
      { filename: SPEC, code: "test(\"plays\", async ({ page }) => { await page.goto(\"/\") })" },
      { filename: SPEC, code: "test.beforeEach(async (fixtures) => {})" },
      { filename: SRC, code: "export const f = (a) => a" },
    ],
    invalid: [
      { filename: SUPPORT, code: "export const login = async (page, role: Role) => page", errors: [{ messageId: "untyped" }] },
      { filename: SUPPORT, code: "export function seed(input) {}", errors: [{ messageId: "untyped" }] },
      { filename: SUPPORT, code: "const pick = function (rows) { return rows }", errors: [{ messageId: "untyped" }] },
      { filename: SUPPORT, code: "export const collect = (...parts) => parts", errors: [{ messageId: "untyped" }] },
      { filename: SUPPORT, code: "export const login = async (page: any) => page", errors: [{ messageId: "any" }] },
      { filename: SPEC, code: "const x: any = 1", errors: [{ messageId: "any" }] },
    ],
  })
})

test("E2E-7: the Playwright config declares the three viewports", () => {
  const config = (sizes) =>
    `export default { projects: [${sizes.map(([w, h]) => `{ use: { viewport: { width: ${w}, height: ${h} } } }`).join(", ")}] }`
  tester.run("playwright-viewports", playwrightViewports, {
    valid: [
      { filename: "D:/repo/playwright.config.ts", code: config([[1440, 900], [768, 1024], [390, 844]]) },
      { filename: "D:/repo/apps/web/playwright.config.ts", code: config([[390, 844], [1440, 900], [768, 1024]]) },
      { filename: SUPPORT, code: "export const v = { viewport: { width: 1, height: 2 } }" },
    ],
    invalid: [
      {
        filename: "D:/repo/playwright.config.ts",
        code: config([[1440, 900], [768, 1024]]),
        errors: [{ messageId: "missing", data: { size: "390x844" } }],
      },
      {
        filename: "D:/repo/playwright.config.ts",
        code: "export default { projects: [{ use: { ...devices[\"Desktop Chrome\"] } }] }",
        errors: [{ messageId: "missing" }, { messageId: "missing" }, { messageId: "missing" }],
      },
      {
        filename: "D:/repo/playwright.config.ts",
        code: config([[1440, 900], [768, 1024], [390, 844], [1920, 1080]]),
        errors: [{ messageId: "extra", data: { size: "1920x1080" } }],
      },
    ],
  })
})
