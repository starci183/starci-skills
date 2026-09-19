/* Lane v5-5 codemod plan: give the specs that render translation-resolving components the en catalogue. */
module.exports = [
    {
        file: "src/features/pages/tasks/index.spec.tsx",
        ops: [
            ["sub", "render(<TasksPage />)", "render(withIntl(<TasksPage />))", 5, "en catalogue for the feature entry"],
        ],
    },
    {
        file: "src/components/recur/schedule-screen.spec.tsx",
        ops: [
            ["sub", "import { render, screen } from \"@testing-library/react\"", "import { render as renderBase, screen } from \"@testing-library/react\"\nimport { NextIntlClientProvider } from \"next-intl\"\nimport type { ReactNode } from \"react\"\nimport messages from \"../../../messages/en.json\"", 1, "next-intl test imports"],
            ["sub", "const noop = () => {}", "const noop = () => {}\n\n/** The screen resolves its copy through next-intl, so the spec supplies the en catalogue - the same\n * words an English reader sees, which is what the assertions below are written against. */\nconst renderView = (ui: ReactNode) => renderBase(\n    <NextIntlClientProvider locale=\"en\" messages={messages}>\n        {ui}\n    </NextIntlClientProvider>,\n)", 1, "en catalogue for the schedule screen"],
            ["sub", "render(", "renderView(", 7, "wrapped render calls"],
        ],
    },
]
