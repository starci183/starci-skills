# viewer token cache identity

## Definition

Viewer-scoped query caches must be keyed by stable viewer identity, not by the current access-token
bytes. Access tokens rotate during one session; treating each rotation as a new viewer discards
populated query keys and makes background refresh repaint ready UI as loading.

## Rules

1. `VIEWER-CACHE-DEBT-1` — A renewed token carrying the same public subject retains the same cache
   identity; a different subject and sign-out must change or remove it.
2. `VIEWER-CACHE-DEBT-2` — Background validation retains the ready tree. A resting/skeleton state is
   selected only when data is absent and the initial request is loading; `isValidating` alone never
   selects it.
3. `VIEWER-CACHE-DEBT-3` — Every configured frontend project must audit its viewer-scoped query
   adapter and loading predicates. Projects without rotating bearer tokens or SWR-style caches record
   the rule as not applicable rather than copying the StarCi implementation.
4. `VIEWER-CACHE-DEBT-4` — The debt closes only when tests prove same-subject token rotation keeps
   the key and rendered ready state, while an actual viewer change cannot receive the previous
   viewer's cached answer.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Hash the complete rotating access token into a query key | Rotation looks like sign-in as another person and clears ready data | Fingerprint a stable public subject, with an opaque-token fallback only when no subject exists |
| Use `isLoading` or `isValidating` alone to select skeleton UI | Revalidation becomes a visible page reset | Require absent data for the resting state and keep cached data mounted during validation |
| Share one constant cache key across viewers | A later viewer can receive the previous viewer's plausible private answer | Include stable viewer identity or disable the query while signed out |

## Examples

Right: token A and renewed token B both carry subject `viewer-1`; the query key and ready article
remain stable while validation runs in the background.

Wrong: token A and token B are fingerprinted byte-for-byte; SWR receives a new key, `data` becomes
undefined, and the reader flashes its skeleton even though the viewer never changed.
