/**
 * Twin tests for the split rule.
 *
 *   node --test the-split.test.mjs
 *
 * The scope is a slot role, so the cases that matter are the ones just outside it: the connected
 * half is SUPPOSED to reach for the world, and a rule that widened to every file in a surface
 * folder would forbid the thing it exists to relocate.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, slotTester } from "./fixtures/typed/tester.mjs"
import { connectedBlockHasPresentationalTwin, presentationalPurity, rules } from "./the-split.mjs"

const tester = slotTester()

const DRAWING = at("apps/web/src/components/blocks/dashboard/DailyQuest/component.tsx")
const CONNECTED = at("apps/web/src/components/blocks/dashboard/DailyQuest/index.tsx")
const HOOK = at("apps/web/src/hooks/swr/useQueryMyDailyQuestSwr.ts")
const NOT_A_BLOCK = at("apps/web/src/modules/components/blocks/DailyQuest/index.tsx")
const NOT_A_DRAWING = at("apps/web/src/modules/components/blocks/DailyQuest/component.tsx")

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
      // a `component.tsx` that no slot owns is not a drawing half
      { filename: NOT_A_DRAWING, code: "const q = useQueryMyDailyQuestSwr()" },
      // the pure half is not the drawing role of another owner's entry
      { filename: at("apps/web/src/components/blocks/dashboard/DailyQuest/classNames.ts"), code: "const t = useTranslations(\"quest\")" },
    ],
    invalid: [
      { filename: DRAWING, code: "const q = useQueryMyDailyQuestSwr()", errors: [{ messageId: "reaches" }] },
      { filename: DRAWING, code: "const t = useTranslations(\"quest\")", errors: [{ messageId: "reaches" }] },
      { filename: DRAWING, code: "const l = useLocale()", errors: [{ messageId: "reaches" }] },
      { filename: DRAWING, code: "const r = queryResolveRoute({ request })", errors: [{ messageId: "reaches" }] },
      // every owner that splits has a drawing half: a feature page and a shared-package leaf too
      { filename: at("apps/web/src/features/pages/Home/component.tsx"), code: "const l = useLocale()", errors: [{ messageId: "reaches" }] },
      { filename: at("packages/nivo-ui/src/leaves/Badge/component.tsx"), code: "const l = useLocale()", errors: [{ messageId: "reaches" }] },
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
          import { DailyQuestBase } from "./component"
          export const DailyQuest = () => {
            const t = useTranslations("quest")
            return <DailyQuestBase state="pending" props={{ label: t("label") }} />
          }
        `,
      },
      {
        filename: CONNECTED,
        code: "export const DailyQuest = ({ props }) => <QuestRows props={props} />",
      },
      // an `index.tsx` that no block owns is not a connected block, whatever its folder is called
      { filename: NOT_A_BLOCK, code: "import { useTranslations } from \"next-intl\"; export const DailyQuest = () => <StatRow label={useTranslations(\"q\")(\"l\")} />" },
      { filename: at("apps/web/src/features/pages/Home/index.tsx"), code: "export const Home = () => <StatRow label={useTranslations(\"q\")(\"l\")} />" },
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
          import { DailyQuestBase } from "./component"
          export const DailyQuest = () => {
            const t = useTranslations("quest")
            return t("empty") ? <EmptyNotice /> : <DailyQuestBase state="ready" props={{ label: t("label") }} />
          }
        `,
        errors: [{ messageId: "bypass" }],
      },
      {
        filename: CONNECTED,
        code: `
          import { useTranslations } from "next-intl"
          import { DailyQuestBase } from "./component"
          export const DailyQuest = () => {
            const t = useTranslations("quest")
            return t("empty")
          }
        `,
        errors: [{ messageId: "unused" }],
      },
      {
        filename: CONNECTED,
        code: `
          import { useTranslations } from "next-intl"
          import { DailyQuestBase } from "./component"
          export const DailyQuest = () => {
            useTranslations("quest")
            return <DailyQuestBase state="pending" props={{ label: "" }} />
          }
          export const DailyQuestMobile = () => DailyQuestBase({ state: "pending", props: { label: "" } })
        `,
        errors: [{ messageId: "called" }],
      },
    ],
  })
})
