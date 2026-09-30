# hooks/ holds hooks

Law module: `hooks-folder.mjs`. Catalogue: R56 FE_HOOKS_ARE_HOOKS (lint half).

`hooks/<domain>/use<Name>.ts` holds one hook per file; `hooks/<domain>/<domain>.shared.ts` holds the domain's non-hook helpers; server readers live in `modules/api/<domain>/read-*.ts`. Whether a folder has exactly one shared file and whether a helper name repeats across files belongs to the architecture machine.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/hooks-folder-holds-hooks-only`

`hooks/<domain>/` holds `use*.ts` hooks and one `<domain>.shared.ts`; nothing else.

**Invalid** (`src/hooks/course/readCourse.ts`)

```ts
export const readCourse = () => 1
```

**Valid** (`src/hooks/course/useCourse.ts`)

```ts
export const useCourse = () => 1
```

**Finding code:** `FE_HOOKS_ARE_HOOKS`

**Why:** `<file>` in `hooks/` is not a React hook. Server readers belong in `modules/api`, helpers in `<domain>.shared.ts`.

**Fix:** One hook per `use*.ts` file; shared helpers go into `<domain>.shared.ts`; server readers go into `modules/api/<domain>/read-*.ts`.
