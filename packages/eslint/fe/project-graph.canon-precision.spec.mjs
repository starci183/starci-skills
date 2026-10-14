import test from "node:test"
import { projectFixture } from "../be/fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

const source = (f, files, rel) => ({ filename: f.at(rel), code: files[rel] })

const page = (name) => [
    "import { useTranslations } from 'next-intl';",
    "import { SiteFrame } from '../../../components/composites/SiteFrame';",
    "import { ROUTES } from '../../../modules/config';",
    `export const ${name}Page = () => {`,
    `    const t = useTranslations('${name.toLowerCase()}');`,
    "    return <SiteFrame",
    "        navigation={{",
    "            brand: t('brand'),",
    "            current: ROUTES.home,",
    "            routes: [",
    "                { href: ROUTES.home, label: t('home') },",
    "                { href: ROUTES.catalog, label: t('catalog'), badge: 1 },",
    "            ],",
    "            account: { displayName: t('account'), href: ROUTES.account },",
    "            footer: { caption: t('footer'), links: [ROUTES.terms, ROUTES.privacy] },",
    "        }}",
    "        main={{",
    "            title: t('title'),",
    "            description: t('description'),",
    "            actions: [{ href: ROUTES.create, label: t('create') }],",
    "        }}",
    "    />;",
    "}",
    "",
].join("\n")

// The same kind of object outside a frame is ordinary business data and stays compared.
const business = (name) => [
    `export const ${name} = (input: { id: string; items: string[]; total: number }) => ({`,
    "    id: input.id,",
    "    value: input.total ?? 1,",
    "    primary: { id: input.id, active: true },",
    "    items: [input.id, ...input.items],",
    "    nested: { values: [input.total, 2, 3], enabled: false },",
    "    names: [{ first: input.id }, { second: input.id }],",
    "    settings: { mode: 'normal', level: input.total, flags: ['a', 'b'] },",
    "    fallback: input.items[0] ?? input.id,",
    "    size: input.items.length + input.total,",
    "});",
    "",
].join("\n")

test("duplicate-code accepts data props of a shared frame while still finding copied business objects", (t) => {
    const files = {
        "apps/web/src/components/composites/SiteFrame/index.tsx": "export const SiteFrame = (props: object) => <main />;\n",
        "apps/web/src/modules/config/index.ts": "export const ROUTES = { home: '/', catalog: '/catalog', account: '/account', terms: '/terms', privacy: '/privacy', create: '/create' };\n",
        "apps/web/src/features/pages/AlphaPage/index.tsx": page("Alpha"),
        "apps/web/src/features/pages/BetaPage/index.tsx": page("Beta"),
        "apps/web/src/modules/alpha/alpha.ts": business("buildAlpha"),
        "apps/web/src/modules/beta/beta.ts": business("buildBeta"),
    }
    const f = projectFixture({ profile: "fe", files })
    t.after(f.cleanup)
    f.tester.run("duplicate-code", rules["duplicate-code"], {
        valid: [
            source(f, files, "apps/web/src/features/pages/AlphaPage/index.tsx"),
            source(f, files, "apps/web/src/features/pages/BetaPage/index.tsx"),
            source(f, files, "apps/web/src/modules/beta/beta.ts"),
        ],
        invalid: [{ ...source(f, files, "apps/web/src/modules/alpha/alpha.ts"), errors: [{ messageId: "finding", line: 1 }] }],
    })
})
