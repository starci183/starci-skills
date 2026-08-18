---
title: Frontend pattern context router
runtime: true
router: true
contextVersion: 1
---

# Frontend pattern context router

## LOADS

None.

## Record

This file routes an accepted frontend shape to the smallest binding runtime context. Load only the
matching child `context.md` files. A directory target does not authorize loading every child, and
`en.md` and `vi.md` are publication records rather than runtime inputs.

## Routing

| Module | Load when the accepted shape contains | Do not load for |
|---|---|---|
| `cache-key` | a cached query or mutation whose answer varies by parameters, viewer, row, readiness or nullable result | uncached data flow or generic component state |
| `comments` | new or changed exports, exceptional mechanics, source-language comments or a lint exception rationale | copy visible to readers or prose outside source |
| `contract` | structural vocabulary, contract keys, element/slot ownership, marker painting or contract entry reachability | ordinary data props, runtime class composition already rejected elsewhere, or visual token choice alone |
| `delivery-assurance` | hook, CI, coverage, analysis, credential or deploy-fence adoption for a frontend | component implementation with an already-green delivery fence |
| `file-layout` | choosing a tier, folder, export family, route mount, shared-package boundary or source marker | class selection or internal code style after the file location is settled |
| `icon` | a glyph, reaction artwork, icon plate, icon role/size or vendor icon mapping | text-only facts, typography or non-icon imagery |
| `landmark` | semantic `header`, `nav`, `main`, `aside` or `footer` ownership and branch selection | generic wrappers with no document landmark role |
| `lint-adoption` | installing, resolving or auditing the published frontend lint machine | responding to one already-resolved lint finding |
| `lint-escape-hatch` | directives, inline configuration, allowlists or attempts to weaken a lint rule | fixing the underlying product-source violation directly |
| `loading` | waiting, skeleton, placeholder, readiness or per-region loading behavior | empty, error or disabled states after loading has settled |
| `naming` | module-level functions, reader-triggered callbacks or shared path language | component tier placement, domain vocabulary or display copy |
| `props-and-slots` | component data shape, named render slots, loading ownership or collection prop naming | contract structural slots or visual appearance variants |
| `served-locale` | locale derived from an address and declared through a response chain | translated copy selection inside an already-resolved locale |
| `the-split` | a component that requests, subscribes or owns external situation state and therefore needs connected/drawing halves | a pure component with no request or external situation resolution |
| `tokens` | spacing, colour pairing, control height, scale membership or arbitrary-value refusal | typography hierarchy except where a closed token scale itself is in question |
| `translation` | reader-visible words, translation keys, dictionaries or copy crossing component tiers | program literals matched by logic or locale transport/declaration |
| `type-safety` | `any`, casts, duplicate type spellings, test-only invalid construction or surviving-cast rationale | domain modeling whose types are already sound and need no narrowing |
| `typography` | heading level, title/subtitle relation, body rank, muted support copy or time-marker hierarchy | spacing, containers or non-text visual hierarchy |
| `vendor-boundary` | a third-party UI primitive, overlay, field, link, menu or vendor-owned mechanics | platform APIs and house components that do not expose a UI vendor |

## Rules

1. Route from facts present in the accepted shape; do not invent a situation merely to select a module.
2. Load every matching module: routes overlap and are not alternatives.
3. Use each selected module's Situation codes to bind the exact source shape.
4. If no row matches, stop at this shelf. Do not scan child publication records for inspiration.

## Output

```text
modules: <selected child context paths>
why: <accepted-shape fact that triggered each module>
excluded: <nearby module considered and the negative scope that excluded it>
```
