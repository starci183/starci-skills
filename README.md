# starci-skills

The v3 StarCi trust tree: one source of truth an agent reads so that a loose business prompt still
lands as correct code.

Four species, split by **what each is allowed to return** — not by the order they run in:

| Tree | Species | Returns |
|---|---|---|
| `contexts/` | location | where source is read from, where state is written |
| `brainstorms/` | creation | 3–4 candidates, the owner chooses |
| `compilers/` | execution | exactly one answer; the law closes the choice — `principles` decide classes, `patterns` decide where the code lands |
| `gates/` | refusal | pass, or reject with the evidence — `lints` only |

`skills/` holds the six capabilities and the reporting shape they share. `scripts/` holds the
validator that makes the JSON schemas real rather than decorative.

Every module is two records of the same document: `en.md` for the agent, `vi.md` for the human. They
match section for section and neither refers to the other.

## Why it refuses

A tree that only advises gets ignored under pressure, so the mechanisms are machine-refusable:

- a layout candidate is **class-free**, enforced by reading 38% of the contract — a stage that cannot
  see a class cannot write one;
- `additionalProperties: false` at every level of every schema makes a stray `className` invalid
  rather than debatable;
- the validator refuses a batch whose candidates share an axis set, or where none departs from
  precedent — a fake choice is not a choice;
- an approval binds to the hash of canonical JSON, with the envelope outside it, so the same decision
  re-run produces the same hash.

## Docs site

The site is generated from the records; nothing under `docs/content/` is hand-authored.

```bash
cd docs
npm install
npm run sync
npm run dev
```

Shelves are declared in `docs/publication.mjs`. A new shelf becomes a documented shelf by adding one
entry there — no page, no route, no sidebar to write.

**A build that needs the author's machine is not a build.** The site must build from a clean clone and
nothing else: no sibling checkout, no absolute path, no workspace route, no generated directory
expected to already exist. This tree is shared across sources, so a dependency on one product's
repository is not a portability bug to soften — it is a category error, and making it fail quietly
keeps the coupling while hiding it. The test: would this step mean anything for a **second** product
using this tree? If not, delete it.

`netlify.toml` carries `base`, `command`, `publish` and a pinned Node version, so the host's fields
stay empty and git can explain when they changed. `publish` resolves relative to `base`.

## Validating an artifact

```bash
node scripts/validate-artifact.mjs \
  --schema brainstorms/layouts/schema.json \
  --data <batch.json> --hash
```
