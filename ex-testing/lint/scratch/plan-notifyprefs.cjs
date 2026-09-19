/* Lane v5-5 codemod plan: ui.notify.preferences (components/notify/preferences). */
module.exports = [
    {
        file: "src/components/notify/preferences/component.tsx",
        ops: [
            ["sub", "<div role=\"main\" aria-label=\"The notification preferences screen\">", "<div role=\"main\" aria-label={copy.mainLabel}>", 1, "notify.preferences.mainLabel"],
            ["sub", "<nav aria-label=\"Breadcrumb\">", "<nav aria-label={copy.breadcrumbLabel}>", 1, "shell.breadcrumb"],
            ["line", "Settings / Notifications", "{copy.breadcrumb}", 1, "notify.preferences.breadcrumb"],
            ["sub", "<Heading level={1}>Notification preferences</Heading>", "<Heading level={1}>{copy.heading}</Heading>", 1, "notify.preferences.heading"],
            ["sub", "<Text tone=\"muted\">Choose whether to receive task updates by email.</Text>", "<Text tone=\"muted\">{copy.tagline}</Text>", 1, "notify.preferences.tagline"],
            ["sub", "<SurfaceCard ariaLabel=\"Notification preferences\">", "<SurfaceCard ariaLabel={copy.heading}>", 1, "notify.preferences.heading"],
            ["sub", "<Heading level={2}>Email digest</Heading>", "<Heading level={2}>{copy.digestHeading}</Heading>", 1, "notify.preferences.digestHeading"],
            ["sub", "<Text tone=\"muted\">Receive grouped task updates in your inbox.</Text>", "<Text tone=\"muted\">{copy.digestTagline}</Text>", 1, "notify.preferences.digestTagline"],
            ["sub", "{subscribed === false ? \"Off\" : \"On\"}", "{subscribed === false ? copy.off : copy.on}", 1, "notify.preferences.off / on"],
            ["sub", "{subscribed === false ? \"Turn on\" : \"Turn off\"}", "{subscribed === false ? copy.turnOn : copy.turnOff}", 1, "notify.preferences.turnOn / turnOff"],
            ["sub", "<Text live=\"polite\">You are unsubscribed from the email digest.</Text>", "<Text live=\"polite\">{copy.unsubscribedNote}</Text>", 1, "notify.preferences.unsubscribedNote"],
            ["sub", "{pending === \"save\" ? \"Saving\u2026\" : \"Save preferences\"}", "{pending === \"save\" ? copy.saving : copy.save}", 1, "notify.preferences.saving / save"],
            ["sub", "href={BACK_TO_TASKS.href}", "href=\"/tasks\"", 1, "tasks route"],
            ["sub", "{BACK_TO_TASKS.label}", "{copy.backToTasks}", 1, "shell.backToTasks"],
            ["line", "Unsubscribe from email", "{copy.unsubscribe}", 1, "notify.preferences.unsubscribe"],
            ["line", "You can also unsubscribe using the link in any email.", "{copy.unsubscribeHint}", 1, "notify.preferences.unsubscribeHint"],
            ["sub", "key={link.label}", "key={link.key}", 1, "footer keys"],
            ["sub", "{link.label}", "{copy.legal[link.key]}", 1, "shell.legal.*"],
        ],
    },
]
