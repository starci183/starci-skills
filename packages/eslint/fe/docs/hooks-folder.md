# hooks/ holds hooks

Law module: `hooks-folder.mjs`. Catalogue: R56 FE_HOOKS_ARE_HOOKS (lint half).

`hooks/` holds the hook families of the front-end stack, each its own slot whose `allows` name its files: `hooks/swr/` (`api/{graphql,rest}/{queries,mutations}/use{Query,Mutate,Get,Post,Put,Patch,Delete}<X>Swr.ts`, one SWR hook per `modules/api` operation, and `SwrSideEffects.tsx`), `hooks/rhf/use<X>Form.ts`, `hooks/zustand/<store>/` (`store.ts` and `use*.ts`), `hooks/socketio/` (`sockets.ts`, `SocketIoSideEffects.tsx`, `enums/`, `types/`, `use*.ts`), `hooks/effects/use*.ts` and `hooks/reuseables/use*.ts`. Beside them, `hooks/<domain>/use<Name>.ts` holds one hook per file and `hooks/<domain>/<domain>.shared.ts` the domain's non-hook helpers. The two side-effect components are the only `.tsx` files of `hooks/`. A call to the back end is an operation of `modules/api`, never a hook's own code. Whether a folder has exactly one shared file and whether a helper name repeats across files belongs to the architecture machine.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/hooks-folder-holds-hooks-only`

`hooks/` holds `use*.ts` hooks under the names their family slot gives and, per domain, one `<domain>.shared.ts`; nothing else. A hook file exports one hook; `server-only` and `next/headers` are never imported there. A hook is a function that calls a hook: a React, SWR or Redux hook, a `use*` imported from the app's own `hooks/` folders (a `hooks/swr` wrapper or a sibling domain hook, resolved by TypeScript symbol resolution through barrels; that hook's own file is judged when it is linted), or a library hook from an explicit list (`next-intl` `useTranslations`/`useLocale`/`useFormatter`/`useNow`/`useTimeZone`/`useMessages`, `next/navigation`, `react-hook-form`, `zustand`). A `use*` from outside every `hooks/` folder or an unlisted library is not a hook by its spelling, and a file that exports a helper, a constant or a component still fails (owner ruling 2026-10-16).

**Invalid** (`src/hooks/course/readCourse.ts`)

```ts
export const readCourse = () => 1
```

**Valid** (`src/hooks/course/useCourse.ts`)

```ts
export const useCourse = () => 1
```

**Finding code:** `FE_HOOKS_ARE_HOOKS`

**Invalid** (`src/hooks/swr/api/graphql/queries/useGetCourseSwr.ts`: a REST name in the GraphQL queries folder)

```ts
export const useGetCourseSwr = () => 1
```

**Valid** (`src/hooks/swr/api/graphql/queries/useQueryCourseSwr.ts`)

```ts
export const useQueryCourseSwr = () => 1
```

**Why:** `<file>` inside `hooks/` is not a React hook, or is not a file its hooks family names. A call to the back end goes to `modules/api`, a helper to `<domain>.shared.ts`.

**Fix:** One hook per `use*.ts` file under the name its family gives it (`hooks/swr/api/graphql/queries/useQuery<X>Swr.ts`, `hooks/rhf/use<X>Form.ts`, ...); a shared helper goes in `<domain>.shared.ts`; a back-end call is an operation of `modules/api`.
