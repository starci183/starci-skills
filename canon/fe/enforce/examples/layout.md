# layout — in a real system

The shell a whole section renders inside — never one screen.

The rule is in [`../elements/layout.md`](../elements/layout.md). This is one system obeying it,
named so every row can be checked.

| Component | Renders | Why this tier |
|---|---|---|
| `LearnShell` | the rail, header and content region every learning route sits in | every route of a section renders inside it |
| `SettingsLayout` | the settings nav beside the settings body | same test — all settings routes, not one |
| `InnerLayout` | the generic signed-in shell | the widest section of all |
| `PublicProfileLayout` | the shell for a public profile's routes | a section with several routes under one identity |
| `HeadhuntingCompaniesLayout` | the shell for the companies section | the narrowest that still passes the test |

## The test, and the way it fails

> Does **every route of a section** render inside it?

A "layout" used by exactly one screen is a composite that got promoted by its name. That is the one
misplacement this tier suffers, and it is easy to spot: count the routes.

## What it owns and what it must not

It owns the shell — rail, header slot, content region, and how those respond to width. It composes
classes for that shell, because the shell is its own shape.

It owns no content. A layout reaching for domain data has become a page with an unusually wide
reach.

---

Read from a live tree with `scripts/audit/scan-storybook-architecture.mjs`. Another repo answers with
different names, and its answer outranks this file.
