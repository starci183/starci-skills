/* Lane v5-5 codemod plan: connected halves' settled refusal sentences (notify). */
module.exports = [
    {
        file: "src/components/notify/preferences/index.tsx",
        ops: [
            ["sub", "? SESSION_REFUSAL_MESSAGE", "? t(\"sessionEnded\")", 1, "notify.preferences.sessionEnded"],
            ["sub", "? LOAD_REFUSAL_MESSAGE", "? t(\"loadRefusal\")", 1, "notify.preferences.loadRefusal"],
            ["sub", "setSaveRefusal(SAVE_REFUSAL_MESSAGE)", "setSaveRefusal(t(\"saveRefusal\"))", 2, "notify.preferences.saveRefusal"],
        ],
    },
]
