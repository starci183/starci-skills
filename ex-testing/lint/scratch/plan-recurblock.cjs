/* Lane v5-5 codemod plan: the connected recur schedule block (components/recur/schedule.tsx). */
module.exports = [
    {
        file: "src/components/recur/schedule.tsx",
        ops: [
            ["sub", "import { useEffect, useState } from \"react\"\nimport { graphql } from \"@/modules/api/graphql\"", "import { useEffect, useState } from \"react\"\nimport { useTranslations } from \"next-intl\"\nimport { graphql } from \"@/modules/api/graphql\"", 1, "next-intl import"],
            ["sub", "/** fr.recur.make-recurring's draft validation, in the form's field order; first failure wins. */\nconst validateDraft = (draft: ScheduleDraft): ScheduleRefusal | null => {", "/** The refusal sentence for each field the draft validation can fail, resolved from `recur`. */\ntype ScheduleDraftRefusalMessages = {\n  readonly n: string;\n  readonly dayOfMonth: string;\n  readonly time: string;\n  readonly timeZone: string;\n  readonly startDate: string;\n};\n\n/** fr.recur.make-recurring's draft validation, in the form's field order; first failure wins. This\n * owner knows which field failed; the sentences arrive resolved, because the words are the\n * dictionary's. */\nconst validateDraft = (draft: ScheduleDraft, messages: ScheduleDraftRefusalMessages): ScheduleRefusal | null => {", 1, "validateDraft takes resolved sentences"],
            ["sub", "return { field: \"n\", message: \"Enter a number of days greater than zero.\" }", "return { field: \"n\", message: messages.n }", 1, "recur.refusalN"],
            ["sub", "return { field: \"dayOfMonth\", message: \"Enter a day of the month from 1 to 31.\" }", "return { field: \"dayOfMonth\", message: messages.dayOfMonth }", 1, "recur.refusalDayOfMonth"],
            ["sub", "return { field: \"time\", message: \"Enter a time of day as HH:MM.\" }", "return { field: \"time\", message: messages.time }", 1, "recur.refusalTime"],
            ["sub", "return { field: \"timeZone\", message: \"Enter an IANA time zone, like Europe/Berlin.\" }", "return { field: \"timeZone\", message: messages.timeZone }", 1, "recur.refusalTimeZone"],
            ["sub", "return { field: \"startDate\", message: \"Enter a start date as YYYY-MM-DD.\" }", "return { field: \"startDate\", message: messages.startDate }", 1, "recur.refusalStartDate"],
            ["sub", "export const ScheduleBlock = (props: ScheduleBlockProps) => {\n    const token = useSessionToken()", "export const ScheduleBlock = (props: ScheduleBlockProps) => {\n    const t = useTranslations(\"recur\")\n    const token = useSessionToken()", 1, "translator"],
            ["sub", "const draftRefusal = validateDraft(draft)", "const draftRefusal = validateDraft(draft, {\n            n: t(\"refusalN\"),\n            dayOfMonth: t(\"refusalDayOfMonth\"),\n            time: t(\"refusalTime\"),\n            timeZone: t(\"refusalTimeZone\"),\n            startDate: t(\"refusalStartDate\"),\n        })", 1, "recur.refusal*"],
            ["sub", "setRefusal({ field: \"form\", message: \"Open a task\\u2019s schedule before saving a rule.\" })", "setRefusal({ field: \"form\", message: t(\"refusalNoTask\") })", 1, "recur.refusalNoTask"],
        ],
    },
]
