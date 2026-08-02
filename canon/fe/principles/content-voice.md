# Content voice

The umbrella over the two narrow rules that already existed — `no-emoji.md` and
`no-uppercase-text.md` — plus the Vietnamese copy section of `landing-marketing.md` §10, promoted
from a landing-only rule to the voice of **every** UI string.

## The test

**Vietnamese copy reads naturally: no English left in where a good Vietnamese word exists, translated
by MEANING rather than word for word; `vi` and `en` both complete; no emoji; no uppercase.**

## The rules

- **Keep English only for standard technical terms** — API, CI/CD, capstone, production. An ordinary
  word that has a good Vietnamese equivalent must be translated: `build` becomes `dựng`, not left as
  "build".
- **Translate the meaning, not the words.** An English idiom rendered literally reads wrong in
  Vietnamese; find the natural equivalent phrasing instead.
- **Labels in the same row or group share a rhythm** — comparable length and structure. One label
  that runs long breaks the reading cadence of the whole group.
- **No emoji** in any text, label or i18n string. When a symbol is needed, use a Phosphor icon.
- **No uppercase or ALL-CAPS**, unless approved for one specific place. Subordinate labels are
  ranked down by small size and muted colour, not by capitalisation.

Already applied in: `landing-marketing.md` §10 (Vietnamese copy: no English where a Vietnamese word
exists, translate by meaning, labels in rhythm), `no-emoji.md`, `no-uppercase-text.md`.

Related: `visual-hierarchy.md` — an eyebrow label is quiet, neither capitalised nor heavier than the
thing it introduces.
