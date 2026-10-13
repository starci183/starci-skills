/**
 * Twin tests for the front-end stack rule (`knowledge/hfs/fe-stack.yaml`, FE_STACK_FORBIDDEN).
 *
 *   node --test fe-stack.spec.mjs
 *
 * The cases that matter are the ones a name check gets wrong: a SUBPATH of a forbidden package (`date-fns/format`,
 * `@mui/material/Button`) is the package, a package that merely starts like one (`d3-array` beside `d3`) is not, and the
 * canonical library of a concern always passes. The forbidden list itself is read from the catalog, so the spec asserts
 * that every forbidden package of the catalog is refused rather than restating the list.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, slotTester } from "./fixtures/typed/tester.mjs"
import { feStackImport, rules } from "./fe-stack.mjs"
import { feStack, forbiddingConcern, packageNameOf } from "./lib/fe-stack.mjs"

const tester = slotTester()

const BLOCK = at("apps/web/src/components/blocks/course/CourseCard/index.tsx")
const HOOK = at("apps/web/src/hooks/swr/api/graphql/queries/useQueryCourseSwr.ts")
const AUTH = at("apps/web/src/modules/auth/index.ts")
const AUTH_CLIENT = at("apps/web/src/modules/auth/client.ts")
const API = at("apps/web/src/modules/api/graphql/clients/index.ts")
const PACKAGE = at("packages/shop-ui/src/leaves/Menu/index.tsx")

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("the catalog is read from the runtime copy: concerns with their canonical packages and their forbidden alternatives", () => {
  const { concerns, forbidden } = feStack()
  assert.ok(concerns.length > 0)
  assert.ok(concerns.every((concern) => typeof concern.id === "string" && Array.isArray(concern.packages) && Array.isArray(concern.forbids)))
  assert.ok(forbidden.size > 0, "the catalog forbids nothing")
  // no package is both a concern's canonical library and another concern's forbidden alternative
  const canonical = new Set(concerns.flatMap((concern) => concern.packages))
  assert.deepEqual([...forbidden.keys()].filter((name) => canonical.has(name)), [])
})

test("a module specifier names its package: scope and name, subpath dropped; a relative or aliased path names none", () => {
  assert.equal(packageNameOf("date-fns/format"), "date-fns")
  assert.equal(packageNameOf("@mui/material/Button"), "@mui/material")
  assert.equal(packageNameOf("moment"), "moment")
  assert.equal(packageNameOf("./moment"), null)
  assert.equal(packageNameOf("@/modules/dayjs"), null)
  assert.equal(packageNameOf("node:fs"), null)
  assert.equal(packageNameOf("@scope"), null)
  assert.equal(packageNameOf(""), null)
  assert.equal(forbiddingConcern("d3-array"), null, "a package that starts like a forbidden one is another package")
})

test("FE-STACK-1: every forbidden package of the catalog is refused, by every import form", () => {
  const forbidden = [...feStack().forbidden.keys()]
  tester.run("fe-stack-import", feStackImport, {
    valid: [],
    invalid: forbidden.map((name) => ({ filename: BLOCK, code: `import x from "${name}"`, errors: [{ messageId: "forbidden" }] })),
  })
})

test("FE-STACK-2: one library per concern; Supabase only in modules/auth", () => {
  tester.run("fe-stack-import", feStackImport, {
    valid: [
      // the canonical library of each concern passes wherever its placement rule allows it
      { filename: HOOK, code: "import useSWR from \"swr\"\nimport useSWRMutation from \"swr/mutation\"" },
      { filename: BLOCK, code: "import { useForm } from \"react-hook-form\"\nimport { z } from \"zod\"" },
      { filename: BLOCK, code: "import { create } from \"zustand\"\nimport { useSelector } from \"react-redux\"" },
      { filename: BLOCK, code: "import { motion } from \"framer-motion\"\nimport { LineChart } from \"recharts\"" },
      { filename: BLOCK, code: "import { House } from \"@phosphor-icons/react\"" },
      { filename: BLOCK, code: "import { useTranslations } from \"next-intl\"" },
      { filename: API, code: "import { ApolloClient } from \"@apollo/client\"" },
      // a package that starts like a forbidden one is another package
      { filename: BLOCK, code: "import { scaleLinear } from \"d3-scale\"" },
      { filename: BLOCK, code: "import Decimal from \"decimal.js\"" },
      // a relative or aliased path is not a package
      { filename: BLOCK, code: "import moment from \"./moment\"\nimport { dayjs } from \"@/modules/dayjs\"" },
      // the identity-provider client is the one Supabase importer
      { filename: AUTH, code: "import { createBrowserClient } from \"@supabase/ssr\"" },
      { filename: AUTH_CLIENT, code: "import { createClient } from \"@supabase/supabase-js\"" },
      { filename: AUTH_CLIENT, code: "import type { Session } from \"@supabase/supabase-js\"" },
      // tooling outside every product slot is not the front end's source
      { filename: at("scripts/seed.ts"), code: "import moment from \"moment\"\nimport { createClient } from \"@supabase/supabase-js\"" },
    ],
    invalid: [
      // the subpath of a forbidden package is the package
      { filename: BLOCK, code: "import { format } from \"date-fns/format\"", errors: [{ messageId: "forbidden" }] },
      { filename: PACKAGE, code: "import Button from \"@mui/material/Button\"", errors: [{ messageId: "forbidden" }] },
      // every import form
      { filename: HOOK, code: "import { useQuery } from \"@tanstack/react-query\"", errors: [{ messageId: "forbidden" }] },
      { filename: HOOK, code: "export { toast } from \"sonner\"", errors: [{ messageId: "forbidden" }] },
      { filename: HOOK, code: "export * from \"formik\"", errors: [{ messageId: "forbidden" }] },
      { filename: HOOK, code: "const m = await import(\"moment\")", errors: [{ messageId: "forbidden" }] },
      { filename: HOOK, code: "const m = require(\"moment\")", errors: [{ messageId: "forbidden" }] },
      // a type-only import still makes the package a dependency
      { filename: HOOK, code: "import type { Moment } from \"moment\"", errors: [{ messageId: "forbidden" }] },
      // the forbidden alternatives of the transport, realtime and icon concerns too
      { filename: API, code: "import { request } from \"graphql-request\"", errors: [{ messageId: "forbidden" }] },
      { filename: HOOK, code: "import { createClient } from \"graphql-ws\"", errors: [{ messageId: "forbidden" }] },
      { filename: BLOCK, code: "import { Star } from \"lucide-react\"", errors: [{ messageId: "forbidden" }] },
      // forbidden in modules/auth as everywhere: Supabase Realtime is not the front end's push channel
      { filename: AUTH, code: "import { RealtimeClient } from \"@supabase/realtime-js\"", errors: [{ messageId: "forbidden" }] },
      // Supabase outside modules/auth: no data reads from the browser
      { filename: HOOK, code: "import { createClient } from \"@supabase/supabase-js\"", errors: [{ messageId: "supabase" }] },
      { filename: API, code: "import { createBrowserClient } from \"@supabase/ssr\"", errors: [{ messageId: "supabase" }] },
      { filename: BLOCK, code: "import type { User } from \"@supabase/supabase-js\"", errors: [{ messageId: "supabase" }] },
      { filename: at("apps/web/src/app/auth/callback/route.ts"), code: "import { createServerClient } from \"@supabase/ssr\"", errors: [{ messageId: "supabase" }] },
      { filename: at("apps/web/src/modules/db/server.ts"), code: "import { createServerClient } from \"@supabase/ssr\"", errors: [{ messageId: "supabase" }] },
    ],
  })
})
