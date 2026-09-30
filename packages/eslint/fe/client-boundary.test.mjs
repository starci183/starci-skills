/**
 * Twin tests for the client-boundary rule (HFS R55).
 *
 *   node --test client-boundary.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, slotTester, typedTester } from "./fixtures/typed/tester.mjs"
import {
  clientNoServerImport,
  serverModuleMarksServerOnly,
  noDangerousHtml,
  rules,
  useClientOnlyAtBoundary,
  webStorageOnlyInModules,
} from "./client-boundary.mjs"


const slots = slotTester()

const DIRECTIVE = "\"use client\"\nexport const X = () => null"
const PLAIN = "export const X = () => null"

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("FE-CLIENT-1: the directive sits only at an interaction boundary", () => {
  slots.run("use-client-only-at-boundary", useClientOnlyAtBoundary, {
    valid: [
      { filename: at("apps/web/src/components/blocks/Feed/index.tsx"), code: DIRECTIVE },
      { filename: at("apps/web/src/components/leaves/Menu/index.tsx"), code: DIRECTIVE },
      { filename: at("apps/web/src/features/overlays/Compose/index.tsx"), code: DIRECTIVE },
      // a workspace package keeps its grammar tiers at src/<tier>, with no components/ folder
      { filename: at("packages/nivo-ui/src/leaves/NivoIcon/index.tsx"), code: DIRECTIVE },
      { filename: at("packages/nivo-ui/src/leaves/NivoGrammar/index.ts"), code: DIRECTIVE },
      { filename: at("packages/nivo-ui/src/branches/Rail/component.tsx"), code: DIRECTIVE },
      { filename: at("packages/nivo-ui/src/branches/Rail/index.tsx"), code: DIRECTIVE },
      { filename: at("apps/web/src/app/error.tsx"), code: DIRECTIVE },
      { filename: at("apps/web/src/app/global-error.tsx"), code: DIRECTIVE },
      { filename: at("apps/web/src/app/[locale]/error.tsx"), code: DIRECTIVE },
      // the providers wrapper the server layout renders around its children (role `providers` of fe.route)
      { filename: at("apps/web/src/app/[locale]/providers.tsx"), code: DIRECTIVE },
      { filename: at("apps/web/src/app/providers.tsx"), code: DIRECTIVE },
      // no directive, no finding, wherever the file sits
      { filename: at("apps/web/src/app/[locale]/layout.tsx"), code: PLAIN },
      { filename: at("apps/web/src/app/[locale]/page.tsx"), code: PLAIN },
      { filename: at("apps/web/src/features/pages/Home/index.tsx"), code: PLAIN },
      // a spec is not product source
      { filename: at("apps/web/src/app/[locale]/page.test.tsx"), code: DIRECTIVE },
      // a string that merely reads like the directive is not one
      { filename: at("apps/web/src/app/[locale]/page.tsx"), code: "const s = \"use client\"" },
    ],
    invalid: [
      { filename: at("apps/web/src/app/[locale]/layout.tsx"), code: DIRECTIVE, errors: [{ messageId: "slot" }] },
      { filename: at("apps/web/src/app/[locale]/page.tsx"), code: DIRECTIVE, errors: [{ messageId: "slot" }] },
      { filename: at("apps/web/src/app/[locale]/loading.tsx"), code: DIRECTIVE, errors: [{ messageId: "slot" }] },
      { filename: at("apps/web/src/app/[locale]/not-found.tsx"), code: DIRECTIVE, errors: [{ messageId: "slot" }] },
      { filename: at("apps/web/src/features/layouts/Shell/index.tsx"), code: DIRECTIVE, errors: [{ messageId: "slot" }] },
      { filename: at("apps/web/src/features/pages/Home/index.tsx"), code: DIRECTIVE, errors: [{ messageId: "slot" }] },
      { filename: at("apps/web/src/components/composites/Row/index.tsx"), code: DIRECTIVE, errors: [{ messageId: "elsewhere" }] },
      // a providers wrapper kept as a layout feature (nivo-fe features/layouts/ConsoleProviders) is not the providers role:
      // the convention puts it at the route tree's providers.tsx
      { filename: at("apps/web/src/features/layouts/ConsoleProviders/index.tsx"), code: DIRECTIVE, errors: [{ messageId: "slot" }] },
      // a file named like the role outside the route tree is no role
      { filename: at("apps/web/src/modules/theme/providers.tsx"), code: DIRECTIVE, errors: [{ messageId: "elsewhere" }] },
      // the package layout does not widen the app layout, and a package composite is not a boundary
      { filename: at("packages/nivo-ui/src/composites/Row/index.tsx"), code: DIRECTIVE, errors: [{ messageId: "elsewhere" }] },
      { filename: at("apps/web/src/leaves/Menu/index.tsx"), code: DIRECTIVE, errors: [{ messageId: "elsewhere" }] },
      { filename: at("apps/web/src/components/branches/Rail/index.tsx"), code: DIRECTIVE, errors: [{ messageId: "elsewhere" }] },
      { filename: at("apps/web/src/components/blocks/Feed/component.tsx"), code: DIRECTIVE, errors: [{ messageId: "elsewhere" }] },
      { filename: at("apps/web/src/hooks/session/useSession.ts"), code: DIRECTIVE, errors: [{ messageId: "elsewhere" }] },
      { filename: at("apps/web/src/modules/api/client.ts"), code: "'use client'\nexport const x = 1", errors: [{ messageId: "elsewhere" }] },
    ],
  })
})

test("FE-CLIENT-2: a client component imports nothing that exists only on the server", () => {
  const CLIENT = at("apps/web/src/components/blocks/Feed/index.tsx")
  slots.run("client-no-server-import", clientNoServerImport, {
    valid: [
      { filename: CLIENT, code: '"use client"\nimport { useState } from "react"' },
      { filename: CLIENT, code: '"use client"\nimport useSWR from "swr"\nimport { readCourses } from "@/hooks/courses/useCourses"' },
      { filename: CLIENT, code: '"use client"\nimport type { Headers } from "next/headers"' },
      // a server component may import all of it
      { filename: at("apps/web/src/features/pages/Home/index.tsx"), code: 'import { headers } from "next/headers"\nimport { readCourses } from "@/modules/api/courses/read-courses"' },
      { filename: at("apps/web/src/features/pages/Home/index.tsx"), code: 'import "server-only"' },
      // a `read-` file outside the api module is not a server reader
      { filename: CLIENT, code: '"use client"\nimport { readLocal } from "@/modules/storage/read-local"' },
      { filename: at("apps/web/src/components/blocks/Feed/index.test.tsx"), code: '"use client"\nimport fs from "node:fs"' },
    ],
    invalid: [
      { filename: CLIENT, code: '"use client"\nimport "server-only"', errors: [{ messageId: "server" }] },
      { filename: CLIENT, code: '"use client"\nimport { cookies } from "next/headers"', errors: [{ messageId: "server" }] },
      { filename: CLIENT, code: '"use client"\nimport fs from "node:fs"', errors: [{ messageId: "server" }] },
      { filename: CLIENT, code: '"use client"\nimport { getTranslations } from "next-intl/server"', errors: [{ messageId: "server" }] },
      { filename: CLIENT, code: '"use client"\nimport { NextResponse } from "next/server"', errors: [{ messageId: "server" }] },
      { filename: CLIENT, code: '"use client"\nimport { join } from "path"', errors: [{ messageId: "server" }] },
      {
        filename: CLIENT,
        code: '"use client"\nimport { readCourses } from "@/modules/api/courses/read-courses"',
        errors: [{ messageId: "server" }],
      },
    ],
  })
})

test("FE-CLIENT-3: web storage is touched only inside modules", () => {
  slots.run("web-storage-only-in-modules", webStorageOnlyInModules, {
    valid: [
      { filename: at("apps/web/src/modules/theme/index.ts"), code: 'window.localStorage.setItem("theme", value)' },
      { filename: at("apps/web/src/modules/session/storage.ts"), code: 'const v = sessionStorage.getItem("k")' },
      { filename: at("apps/web/src/components/blocks/Feed/index.tsx"), code: "const store = { localStorage: 1 }" },
      { filename: at("apps/web/src/components/blocks/Feed/index.tsx"), code: "const v = repo.localStorage" },
      { filename: at("apps/web/src/components/blocks/Feed/index.test.tsx"), code: 'localStorage.clear()' },
    ],
    invalid: [
      { filename: at("apps/web/src/components/blocks/Feed/index.tsx"), code: 'const v = localStorage.getItem("k")', errors: [{ messageId: "storage" }] },
      { filename: at("apps/web/src/components/blocks/Feed/index.tsx"), code: 'sessionStorage.setItem("k", "v")', errors: [{ messageId: "storage" }] },
      { filename: at("apps/web/src/features/layouts/Sidebar/index.tsx"), code: 'const v = globalThis.localStorage?.getItem("k")', errors: [{ messageId: "storage" }] },
      { filename: at("apps/web/src/hooks/session/useDraft.ts"), code: 'window.sessionStorage.removeItem("k")', errors: [{ messageId: "storage" }] },
    ],
  })
})

test("FE-CLIENT-4: raw HTML only on a script", () => {
  slots.run("no-dangerous-html", noDangerousHtml, {
    valid: [
      { code: "const A = () => <script type=\"application/ld+json\" dangerouslySetInnerHTML={{ __html: JSON_LD }} />" },
      { code: "const A = () => <p>{text}</p>" },
      { filename: at("apps/web/src/components/blocks/Feed/index.test.tsx"), code: "const A = () => <div dangerouslySetInnerHTML={{ __html: x }} />" },
    ],
    invalid: [
      { code: "const A = () => <div dangerouslySetInnerHTML={{ __html: html }} />", errors: [{ messageId: "html" }] },
      { code: "const A = () => <Article dangerouslySetInnerHTML={{ __html: html }} />", errors: [{ messageId: "html" }] },
      { code: "const A = () => <span dangerouslySetInnerHTML={{ __html: t('x') }} />", errors: [{ messageId: "html" }] },
    ],
  })
})

// -- FE-CLIENT-2b: the server marker -----------------------------------------------------------------

const typed = typedTester()
const MODULE = at("apps/web/src/modules/kernel/read-things.ts")
const HOOK = at("apps/web/src/hooks/lesson/useLesson.ts")
const FEATURE = at("apps/web/src/features/pages/home/index.tsx")
const MARKED = 'import "server-only"\n'

test("FE-CLIENT-2b: a module that uses the server marks itself server-only", () => {
  typed.run("server-module-marks-server-only", serverModuleMarksServerOnly, {
    valid: [
      // marked, whatever it imports
      { filename: MODULE, code: MARKED + 'import { headers } from "next/headers"\nexport const read = () => headers()' },
      { filename: MODULE, code: MARKED + 'import { getTranslations } from "next-intl/server"\nexport const t = () => getTranslations()' },
      { filename: MODULE, code: MARKED + 'import { readFile } from "node:fs/promises"\nexport const r = readFile' },
      { filename: MODULE, code: '/** The reader. */\nimport "server-only"\nimport { NextResponse } from "next/server"\nexport const r = NextResponse' },
      // importing a marked module from a marked module
      { filename: MODULE, code: MARKED + 'import { readMarked } from "../marked/read-marked"\nexport const r = readMarked' },
      // a module with no server import needs no marker; importing an unmarked module does not make one
      { filename: MODULE, code: 'import { plain } from "../marked/plain"\nexport const r = plain' },
      { filename: MODULE, code: 'import { useState } from "react"\nexport const r = useState' },
      // type-only imports carry no runtime
      { filename: MODULE, code: 'import type { NextRequest } from "next/server"\nexport type R = NextRequest' },
      { filename: MODULE, code: 'import { type NextRequest } from "next/server"\nexport type R = NextRequest' },
      { filename: MODULE, code: 'import type { readMarked } from "../marked/read-marked"\nexport type R = typeof readMarked' },
      // route files are server components by construction: decided by the slot, not the name
      { filename: at("apps/web/src/app/[locale]/page.tsx"), code: 'import { headers } from "next/headers"\nexport default async function Page() { await headers(); return null }' },
      { filename: at("apps/web/src/app/[locale]/api/x/route.ts"), code: 'import { NextResponse } from "next/server"\nexport const GET = () => NextResponse.json({})' },
      { filename: at("apps/web/src/proxy.ts"), code: 'import { NextResponse } from "next/server"\nexport const proxy = () => NextResponse.next()' },
      // a server COMPONENT (feature page, connected block) is judged by reachability (FE_CLIENT_REACHES_SERVER), not by a marker:
      // starci-next-fe components/blocks/LearnContentSections/index.tsx imports a marked reader and needs no marker of its own
      { filename: FEATURE, code: 'import { getTranslations } from "next-intl/server"\nexport default async function Home() { await getTranslations(); return null }' },
      { filename: at("apps/web/src/components/blocks/Sections/index.tsx"), code: 'import { readMarked } from "../../../modules/marked/read-marked"\nexport const Sections = async () => { await readMarked(); return null }' },
      // a marked reader passes
      { filename: at("apps/web/src/modules/api/course/read-course.ts"), code: MARKED + 'import { get } from "../client"\nexport const readCourse = () => get("/course")' },
      // a client file is client-no-server-import's business
      { filename: HOOK, code: '"use client"\nimport { headers } from "next/headers"\nexport const useX = () => headers' },
      // specs and files no slot owns are not judged
      { filename: at("apps/web/src/modules/kernel/read-things.spec.ts"), code: 'import fs from "node:fs"\nexport const r = fs' },
      { filename: at("docs/scratch.ts"), code: 'import fs from "node:fs"\nexport const r = fs' },
    ],
    invalid: [
      { filename: MODULE, code: 'import { headers } from "next/headers"\nexport const read = () => headers()', errors: [{ messageId: "mark" }] },
      { filename: MODULE, code: 'import { cookies } from "next/headers"\nexport const read = () => cookies()', errors: [{ messageId: "mark" }] },
      { filename: MODULE, code: 'import { NextResponse } from "next/server"\nexport const r = NextResponse', errors: [{ messageId: "mark" }] },
      { filename: MODULE, code: 'import { getTranslations } from "next-intl/server"\nexport const t = () => getTranslations()', errors: [{ messageId: "mark" }] },
      { filename: MODULE, code: 'import { readFile } from "node:fs/promises"\nexport const r = readFile', errors: [{ messageId: "mark" }] },
      { filename: MODULE, code: 'import fs from "fs"\nexport const r = fs', errors: [{ messageId: "mark" }] },
      // the marker must come first: after other imports it is not "starts with"
      { filename: MODULE, code: 'import { headers } from "next/headers"\nimport "server-only"\nexport const r = headers', errors: [{ messageId: "mark" }] },
      // a module reached through a resolved import that is itself server-only
      { filename: MODULE, code: 'import { readMarked } from "../marked/read-marked"\nexport const r = readMarked', errors: [{ messageId: "mark" }] },
      { filename: HOOK, code: 'import { readMarked } from "../../modules/marked/read-marked"\nexport const useX = () => readMarked()', errors: [{ messageId: "mark" }] },
      { filename: MODULE, code: 'export { readMarked } from "../marked/read-marked"', errors: [{ messageId: "mark" }] },
      { filename: MODULE, code: 'export * from "../marked/read-marked"', errors: [{ messageId: "mark" }] },
      // a server reader is server-only by its role, even when it imports only the client
      { filename: at("apps/web/src/modules/api/course/read-course.ts"), code: 'import { get } from "../client"\nexport const readCourse = () => get("/course")', errors: [{ messageId: "mark" }] },
      // one report per server import
      { filename: MODULE, code: 'import { headers } from "next/headers"\nimport fs from "node:fs"\nexport const r = [headers, fs]', errors: [{ messageId: "mark" }, { messageId: "mark" }] },
    ],
  })
})
