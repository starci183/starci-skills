# No emoji in the UI — STRICT

## The rules

**No emoji in product UI text** — labels, tabs, buttons, chips, translation strings, headings. Emoji
render differently on every operating system and font, so the same label is a flat glyph on one
platform and a glossy three-dimensional one on the next. They look unprofessional at label size, and
they sit outside the design system entirely: nothing about their size, weight or colour follows a
token, so they ignore dark mode, they ignore the type scale, and they cannot be restyled later.

They also read badly. A screen reader announces the full Unicode name — "globe showing
Europe-Africa" — in the middle of a label the author thought was two words long, which is why a
currency toggle reads "Local currency, VND" and "International, USD" rather than carrying a flag and
a globe.

**When a symbol is genuinely needed, use an icon from the icon set** the design system already ships,
placed next to the text. An icon inherits the system's colour and size tokens, so it stays consistent
across themes and can be given (or denied) an accessible name deliberately. For an international
marker that is a globe icon — but first ask whether an icon is needed at all, because the words are
usually enough, and an icon that repeats the label is a second thing to align, translate around and
maintain.

**A translation string contains no emoji.** Keep the message plain text; decoration is the
component's job. An emoji inside a translation is copied into every locale by whoever forks the
string, and it silently survives a rewording that made it wrong.
