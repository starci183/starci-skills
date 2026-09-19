/* Lane v5-5 codemod plan: the email unsubscribe screen (components/notify/unsubscribe). */
module.exports = [
    {
        file: "src/components/notify/unsubscribe/component.tsx",
        ops: [
            ["sub", "const { state, tokenMissing } = props", "const copy = props.copy\n    const { state, tokenMissing } = props", 1, "copy binding"],
            ["sub", "<div role=\"main\" aria-label=\"The email unsubscribe screen\">", "<div role=\"main\" aria-label={copy.mainLabel}>", 1, "notify.unsubscribe.mainLabel"],
            ["sub", "<Text weight=\"semibold\">Todo app</Text>", "<Text weight=\"semibold\">{copy.brand}</Text>", 1, "shell.brand"],
            ["sub", "<Heading level={1}>Unsubscribe from email</Heading>", "<Heading level={1}>{copy.heading}</Heading>", 1, "notify.unsubscribe.heading"],
            ["sub", "<Text tone=\"muted\">Stop the task digest for this address.</Text>", "<Text tone=\"muted\">{copy.tagline}</Text>", 1, "notify.unsubscribe.tagline"],
            ["sub", "<Text live=\"polite\">This unsubscribe link is missing its token.</Text>", "<Text live=\"polite\">{copy.tokenMissing}</Text>", 1, "notify.unsubscribe.tokenMissing"],
            ["sub", "<Text live=\"polite\">You are unsubscribed from email.</Text>", "<Text live=\"polite\">{copy.done}</Text>", 1, "notify.unsubscribe.done"],
            ["sub", "<Text live=\"polite\">We could not unsubscribe you. This link may have expired.</Text>", "<Text live=\"polite\">{copy.refused}</Text>", 1, "notify.unsubscribe.refused"],
            ["sub", "{state === \"pending\" ? \"Unsubscribing\u2026\" : \"Unsubscribe from email\"}", "{state === \"pending\" ? copy.pending : copy.action}", 1, "notify.unsubscribe.pending / action"],
            ["sub", "key={link.label}", "key={link.key}", 1, "footer keys"],
            ["sub", "{link.label}", "{copy.legal[link.key]}", 1, "shell.legal.*"],
        ],
    },
]
