/* Lane v5-5 codemod plan: the recur product shell (components/recur/workspace.tsx). */
module.exports = [
    {
        file: "src/components/recur/workspace.tsx",
        ops: [
            ["sub", "import { useRouter } from \"next/navigation\"", "import { useRouter } from \"next/navigation\"\nimport { useTranslations } from \"next-intl\"", 1, "next-intl import"],
            ["sub", "export const RecurWorkspace = (props: RecurWorkspaceProps) => {\n    const router = useRouter()", "export const RecurWorkspace = (props: RecurWorkspaceProps) => {\n    const t = useTranslations(\"recur\")\n    const tShell = useTranslations(\"shell\")\n    const router = useRouter()", 1, "translators"],
            ["sub", "<span className={BRAND_CLASS_NAME}>Todo app</span>", "<span className={BRAND_CLASS_NAME}>{tShell(\"brand\")}</span>", 2, "shell.brand"],
            ["sub", "<nav aria-label=\"Destinations\" className={NAV_GROUP_CLASS_NAME}>", "<nav aria-label={tShell(\"navDestinations\")} className={NAV_GROUP_CLASS_NAME}>", 1, "shell.navDestinations"],
            ["sub", "compactNavigationLabel=\"Destinations\"", "compactNavigationLabel={tShell(\"navDestinations\")}", 1, "shell.navDestinations"],
            ["sub", "<nav aria-label=\"Breadcrumb\" className={BREADCRUMB_CLASS_NAME}>", "<nav aria-label={tShell(\"breadcrumb\")} className={BREADCRUMB_CLASS_NAME}>", 1, "shell.breadcrumb"],
            ["line", "Tasks", "{tShell(\"destinations.tasks\")}", 1, "shell.destinations.tasks"],
            ["sub", "<Text as=\"span\">Schedule</Text>", "<Text as=\"span\">{t(\"breadcrumbSchedule\")}</Text>", 1, "recur.breadcrumbSchedule"],
            ["sub", "<Heading level={1}>Repeat this task</Heading>", "<Heading level={1}>{t(\"heading\")}</Heading>", 1, "recur.heading"],
            ["sub", "<Text tone=\"muted\">No task selected.</Text>", "<Text tone=\"muted\">{t(\"noTask\")}</Text>", 1, "recur.noTask"],
            ["line", "Back to task", "{tShell(\"backToTask\")}", 1, "shell.backToTask"],
            ["line", "Privacy policy", "{tShell(\"legal.privacyPolicy\")}", 1, "shell.legal.privacyPolicy"],
            ["line", "Terms", "{tShell(\"legal.terms\")}", 1, "shell.legal.terms"],
            ["sub", "primaryLabel=\"A recurring task's schedule\"", "primaryLabel={t(\"primaryLabel\")}", 1, "recur.primaryLabel"],
        ],
    },
]
