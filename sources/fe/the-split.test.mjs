/**
 * Twin tests for the split rule.
 *
 *   node --test the-split.test.mjs
 *
 * The scope is a filename, so the cases that matter are the ones just outside it: the connected
 * half is SUPPOSED to reach for the world, and a rule that widened to every file in a surface
 * folder would forbid the thing it exists to relocate.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { connectedBlockHasPresentationalTwin, presentationalPurity, rules } from "./the-split.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const DRAWING = "D:/repo/src/components/blocks/dashboard/DailyQuest/component.tsx"
const CONNECTED = "D:/repo/src/components/blocks/dashboard/DailyQuest/index.tsx"
const HOOK = "D:/repo/src/hooks/swr/useQueryMyDailyQuestSwr.ts"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("SPLIT-1: the drawing half receives everything and asks for nothing", () => {
  tester.run("presentational-purity", presentationalPurity, {
    valid: [
      { filename: DRAWING, code: "const E = (input) => input.props.label" },
      // deciding how a settled situation LOOKS is exactly this file's job
      { filename: DRAWING, code: "const isLoading = input.state === \"pending\"" },
      // the connected half is supposed to reach for the world
      { filename: CONNECTED, code: "const quest = useQueryMyDailyQuestSwr()" },
      { filename: CONNECTED, code: "const t = useTranslations(\"quest\")" },
      // and so is a hook
      { filename: HOOK, code: "const data = useSWR(key, fetcher)" },
      // a call that merely looks similar is not reaching for anything
      { filename: DRAWING, code: "const rows = useMemo(() => build(input), [input])" },
    ],
    invalid: [
      { filename: DRAWING, code: "const q = useQueryMyDailyQuestSwr()", errors: [{ messageId: "reaches" }] },
      { filename: DRAWING, code: "const t = useTranslations(\"quest\")", errors: [{ messageId: "reaches" }] },
      { filename: DRAWING, code: "const l = useLocale()", errors: [{ messageId: "reaches" }] },
      { filename: DRAWING, code: "const r = queryResolveRoute({ request })", errors: [{ messageId: "reaches" }] },
    ],
  })
})

test("SPLIT-5: a connected block renders only its exact pure twin", () => {
  tester.run("connected-block-has-presentational-twin", connectedBlockHasPresentationalTwin, {
    valid: [
      {
        filename: CONNECTED,
        code: `
          import { useTranslations } from "next-intl"
          import { _DailyQuest } from "./component"
          export const DailyQuest = () => {
            const t = useTranslations("quest")
            return <_DailyQuest state="pending" props={{ label: t("label") }} />
          }
        `,
      },
      {
        filename: CONNECTED,
        code: "export const DailyQuest = ({ props }) => <QuestRows props={props} />",
      },
    ],
    invalid: [
      {
        filename: CONNECTED,
        code: `
          import { useTranslations } from "next-intl"
          export const DailyQuest = () => <StatRow props={{ label: useTranslations("quest")("label") }} />
        `,
        errors: [{ messageId: "missing" }],
      },
      {
        filename: CONNECTED,
        code: `
          import { useTranslations } from "next-intl"
          import { _DailyQuest } from "./component"
          export const DailyQuest = () => {
            const t = useTranslations("quest")
            return t("empty") ? <EmptyNotice /> : <_DailyQuest state="ready" props={{ label: t("label") }} />
          }
        `,
        errors: [{ messageId: "bypass" }],
      },
      {
        filename: CONNECTED,
        code: `
          import { useTranslations } from "next-intl"
          import { _DailyQuest } from "./component"
          export const DailyQuest = () => {
            const t = useTranslations("quest")
            return t("empty")
          }
        `,
        errors: [{ messageId: "unused" }],
      },
    ],
  })
})
