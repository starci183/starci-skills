# Concept — Init V2 and seeders (git-sourced content)

Source: `src/modules/init/`.

`InitModule.register({ isGlobal: true })` runs at startup and carries two things: the seeders and the
startup synchronizers. V2 means the content is sourced from git — an Octokit tarball plus a diff —
rather than read only from a local `.mount/`.

## The four pieces

- **`init/data-git/`** pulls content from a git repository as a tarball and uses it as the seed
  source, instead of assuming `.mount/data` already exists on the machine.
- **`init/diff/seed-config-overlay.service.ts`** compares the new version against what has already
  been seeded and applies only the difference as an overlay, so a change does not cost a full reseed.
- **`init/scope/`** — `seed-scope.service.ts` and `sync-scope.service.ts` narrow a seed or a sync to
  one course or one module rather than always running the whole set.
- **`init/seeders/`** are per domain. Re-counted 2026-08-03: `achievements/ advertisements/ blog/
  catalog/ changelog/ coding-problems/ courses/ cv/ foundations/ headhuntings/ mock-interview-eq/`,
  plus `shared/` holding the common parsers (`extracts/extract-json-from-md.service.ts`,
  `merge/merge.service.ts` — see [`mount-content-parsing.md`](mount-content-parsing.md)) and
  `types/`.

## Seeding is manual

`PrimaryPostgreSQLModule.register({ withSeeders: { manualSeed: true } })` means the seeders do
**not** run at boot; they are triggered through the CLI or the init flow. Do not write code that
assumes the database has been seeded.

## Bootstrap order

`EnvModule` loads the environment, the Winston logger becomes available, the database connects,
`InitModule` runs the seeders where needed plus the startup synchronizers (see
[`elasticsearch-sync.md`](elasticsearch-sync.md)), and only then does the app bind HTTP, GraphQL and
Socket.
