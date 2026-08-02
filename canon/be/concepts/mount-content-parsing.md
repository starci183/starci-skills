# Mount content parsing (`.mount/data/**/*.md` to entity)

Source: `src/modules/init/seeders/shared/extracts/`,
`src/modules/init/seeders/shared/merge/`, `src/modules/init/seeders/courses/`.

A fixed two-function parser turns markdown course content into an entity graph. It is consumed by
[init-v2-and-seeders](init-v2-and-seeders.md).

## The separator token

Every leaf — every final string — is wrapped:

```
<!-- @starci/seperator -->…value…<!-- @starci/seperator -->
```

`ExtractJsonFromMdService`
(`init/seeders/shared/extracts/extract-json-from-md.service.ts`) cuts on that token; the headings
(`#`, `##`, `###`) define the tree around it.

## Two public functions, and no third

- `parse(params)` handles one item: find the path, extract each locale into `jsonMap`, merge through
  `MergeJsonService`, then render the entity graph straight from `merged`.
- `parseMany(params)` is only a loop over `parse`, skipping and logging on failure rather than
  throwing partway through — one broken mount file must not abort a whole seed run.

The reference implementations are `course.service.ts`, `content.service.ts` and
`challenge.service.ts`.

## Render from `merged`, never walk `jsonMap` by hand

`MergeJsonService` (`init/seeders/shared/merge/merge.service.ts`) has already attached
`translations[]` according to the `translateFields` config, addressed by dot-path:

- `"title"` — a root scalar
- `"prerequisites.text"` — one array level deep
- `"requirements.data.title"` — two levels of nesting

There is no `[]` syntax; the dots are enough. Walking `jsonMap` manually re-implements this and drifts
from it.

## English goes first

The `jsons` input to the merge is forced to `[Locale.En, ...rest]`. Do not pass raw
`Object.values(Locale)` — its order is not guaranteed, and the specs assert that `translations[0]` is
always English.

## Nested folder leaves

Leaves that live in child folders — `bodies/<N>-<lang>/`, `submissions/<N>/` — get their own private
method, `parseBodies()` / `parseSubmissions()`, which scans the folder and then merges per locale.

## When `extract()` runs twice on the same field

If a string leaf surfaces where an object was expected, `extract()` has been called a second time on
an already-extracted field. **The fault is in the mount file** — a mis-wrapped separator or a wrong
heading depth. Do not patch the parser to tolerate it; the tolerance would then hide every future
malformed file.

## Two formats live side by side

Legacy V1 uses rubric prose and a full inline `# body`. V2 uses `outcomeCriteria` /
`approachCriteria` as yes/no, with the body split out into `bodies/<N>-<lang>/`. The seeder routes on
a marker: whether the H1 `# approachCriteria` is present.
