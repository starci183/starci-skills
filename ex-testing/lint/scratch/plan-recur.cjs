/* Lane v5-5 codemod plan: ui.recur.schedule (components/recur). */
module.exports = [
    {
        file: "src/components/recur/schedule-screen.tsx",
        ops: [
            ["sub", "<SurfaceCard ariaLabel=\"Schedule\">", "<SurfaceCard ariaLabel={t(\"scheduleCard\")}>", 2, "recur.scheduleCard"],
            ["sub", "aria-label=\"Repeat\"", "aria-label={t(\"repeatLabel\")}", 1, "recur.repeatLabel"],
            ["sub", "<Heading level={2}>Schedule</Heading>", "<Heading level={2}>{t(\"scheduleCard\")}</Heading>", 2, "recur.scheduleCard"],
            ["sub", "<span id=\"recur-frequency-label\" className={FIELD_LABEL_CLASS_NAME}>Frequency</span>", "<span id=\"recur-frequency-label\" className={FIELD_LABEL_CLASS_NAME}>{t(\"frequency\")}</span>", 1, "recur.frequency"],
            ["sub", "{option.label}", "{t(option.labelKey)}", 1, "recur.freq*"],
            ["sub", "label=\"Every (days)\"", "label={t(\"everyDays\")}", 1, "recur.everyDays"],
            ["sub", "label=\"Day of the month\"", "label={t(\"dayOfMonth\")}", 1, "recur.dayOfMonth"],
            ["sub", "label=\"Time of day\"", "label={t(\"timeOfDay\")}", 1, "recur.timeOfDay"],
            ["sub", "hint=\"Use 24-hour format (e.g. 14:30).\"", "hint={t(\"timeOfDayHint\")}", 1, "recur.timeOfDayHint"],
            ["sub", "label=\"Time zone\"", "label={t(\"timeZone\")}", 1, "recur.timeZone"],
            ["sub", "hint=\"Uses your selected local time zone.\"", "hint={t(\"timeZoneHint\")}", 1, "recur.timeZoneHint"],
            ["sub", "label=\"Start date\"", "label={t(\"startDate\")}", 1, "recur.startDate"],
            ["sub", "hint=\"The first time this task should occur.\"", "hint={t(\"startDateHint\")}", 1, "recur.startDateHint"],
            ["sub", "{isSaving ? \"Saving...\" : \"Save schedule\"}", "{isSaving ? t(\"saving\") : t(\"save\")}", 1, "recur.saving / save"],
            ["line", "Cancel", "{t(\"cancel\")}", 1, "recur.cancel"],
            ["line", "End rule", "{t(\"endRule\")}", 1, "recur.endRule"],
        ],
    },
    {
        file: "src/components/recur/end-rule-confirm.tsx",
        ops: [
            ["sub", "import { Button, Text } from \"@starci/grammar/common\"", "import { useTranslations } from \"next-intl\"\nimport { Button, Text } from \"@starci/grammar/common\"", 1, "next-intl import"],
            ["sub", "export const EndRuleConfirm = (props: EndRuleConfirmProps) => {\n    return (", "export const EndRuleConfirm = (props: EndRuleConfirmProps) => {\n    const t = useTranslations(\"recur\")\n    return (", 1, "translator"],
            ["sub", "<Text>End this rule? No new occurrences are created; the occurrences already materialised are kept.</Text>", "<Text>{t(\"endConfirm\")}</Text>", 1, "recur.endConfirm"],
            ["sub", "{props.isEnding ? \"Ending...\" : \"End rule\"}", "{props.isEnding ? t(\"ending\") : t(\"endRule\")}", 1, "recur.ending / endRule"],
            ["line", "Keep rule", "{t(\"keepRule\")}", 1, "recur.keepRule"],
        ],
    },
    {
        file: "src/components/recur/upcoming-list.tsx",
        ops: [
            ["sub", "import { EmptyNotice, StaticStateRow, SurfaceListCard } from \"@starci/grammar/common\"", "import { useTranslations } from \"next-intl\"\nimport { EmptyNotice, StaticStateRow, SurfaceListCard } from \"@starci/grammar/common\"", 1, "next-intl import"],
            ["sub", "const upcoming = props.upcoming\n    const previewDates", "const t = useTranslations(\"recur\")\n    const upcoming = props.upcoming\n    const previewDates", 1, "translator"],
            ["sub", "label=\"Upcoming occurrences\"", "label={t(\"upcoming\")}", 1, "recur.upcoming"],
            ["sub", "description: \"Preview - not yet materialised\"", "description: t(\"previewNote\")", 1, "recur.previewNote"],
            ["sub", "message=\"Nothing upcoming\"", "message={t(\"nothingUpcoming\")}", 1, "recur.nothingUpcoming"],
            ["sub", "description=\"This rule has ended, so it will not create new occurrences; the rows above are kept.\"", "description={t(\"endedNote\")}", 1, "recur.endedNote"],
        ],
    },
]
