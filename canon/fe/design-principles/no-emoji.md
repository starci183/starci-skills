# No emoji in the UI — STRICT

Ruled 2026-06-24: the flag and globe emoji came off the currency toggle labels.

## The rules

**No emoji in product UI text** — labels, tabs, buttons, chips, i18n strings, headings. Emoji render
differently on every OS and font, they look unprofessional, and they are outside the design system
entirely: nothing about their size, weight or colour follows a token. The currency labels read
"Trong nước · VND" and "Quốc tế · USD" rather than carrying a flag or a globe glyph.

**When a symbol is genuinely needed, use a phosphor icon** from `@phosphor-icons/react` (the `*Icon`
exports) next to the text. An icon takes the system's colour and size tokens, so it stays consistent.
For a flag or an international marker that would be `GlobeIcon` — but first ask whether an icon is
needed at all, because the words are usually enough.

**An i18n string contains no emoji.** Keep the message plain text; decoration is the component's job
and does not belong inside a translation, where it would be copied into every locale and silently
survive rewording.

## First applied 2026-06-24

`PaymentModal`'s currency toggle: the Vietnam-flag and globe emoji were removed from
`payment.currency.{vnd,usd}` in both `vi` and `en`, leaving text only.
