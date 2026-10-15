// proves: FE_I18N_KEYS@lite
// proves: FE_I18N_KEYS@full
import test from "node:test"
import { projectFixture } from "../be/fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

const GOOD = "apps/web/src/modules/i18n/use-title.ts"
const BAD = "apps/web/src/modules/i18n/use-missing.ts"
const validCode = [
    "import { useTranslations } from 'next-intl'",
    "export const useTitle = () => {",
    "  const t = useTranslations('home')",
    "  return t('title')",
    "}",
].join("\n")
const invalidCode = validCode.replace("useTitle", "useMissing").replace("t('title')", "t.rich('missing')")

for (const edition of ["lite", "full"]) {
    test(`${edition} FE_I18N_KEYS accepts catalog keys and rejects a missing literal key`, (t) => {
        const fixture = projectFixture({
            profile: "fe",
            edition,
            files: {
                "apps/web/src/modules/i18n/messages/en.json": JSON.stringify({ home: { title: "Home" } }),
                "apps/web/src/modules/i18n/messages/vi.json": JSON.stringify({ home: { title: "Trang chu" } }),
                [GOOD]: validCode,
                [BAD]: invalidCode,
            },
        })
        t.after(fixture.cleanup)
        fixture.tester.run("i18n-keys", rules["i18n-keys"], {
            valid: [{ filename: fixture.at(GOOD), code: validCode }],
            invalid: [{
                filename: fixture.at(BAD),
                code: invalidCode,
                errors: [{ messageId: "finding", line: 4 }],
            }],
        })
    })
}
