/* Lane v5-5 codemod plan: gate fallout - cap sentences, the internal-href owner, the recur spec path. */
module.exports = [
    {
        file: "src/components/plan/usage-screen/component.tsx",
        ops: [
            ["sub", "{copy.formatAtCap(props.cap)}", "{atCapSentence}", 1, "plan.atCap via the guarded sentence"],
            ["sub", "{copy.formatOverCapCount(props.activeCount, props.cap)}", "{overCapCountSentence}", 1, "plan.overCapCount via the guarded sentence"],
            ["sub", "{copy.formatOverCapPaused(props.cap)}", "{overCapPausedSentence}", 1, "plan.overCapPaused via the guarded sentence"],
        ],
    },
    {
        file: "src/components/notify/preferences/component.tsx",
        ops: [
            ["sub", "href=\"/tasks\"", "href={BACK_TO_TASKS_HREF}", 1, "routed href stays a named const"],
            ["sub", "/** The policy routes every signed-in screen's footer names. */", "/** The route \"Back to tasks\" travels to; an inline href would bypass the navigation owner. */\nconst BACK_TO_TASKS_HREF = \"/tasks\"\n\n/** The policy routes every signed-in screen's footer names. */", 1, "named route const"],
        ],
    },
    {
        file: "src/components/audit/privacy/component.tsx",
        ops: [
            ["sub", "href=\"/tasks\"", "href={BACK_TO_TASKS_HREF}", 1, "routed href stays a named const"],
            ["sub", "const FOOTER_LINKS = [", "/** The route \"Back to tasks\" travels to; an inline href would bypass the navigation owner. */\nconst BACK_TO_TASKS_HREF = \"/tasks\"\n\nconst FOOTER_LINKS = [", 1, "named route const"],
        ],
    },
    {
        file: "src/components/recur/schedule-screen.spec.tsx",
        ops: [
            ["sub", "../../../messages/en.json", "../../messages/en.json", 1, "spec catalogue path"],
        ],
    },
]
