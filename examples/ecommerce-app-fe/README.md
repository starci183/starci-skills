# ecommerce-app-fe — Next.js monorepo example

The frontend half of the ecommerce example, shaped like `nivo-fe`: one repo, npm workspaces, one deployable
Next.js app per `apps/*` site. Two apps:

| app | package | what it is | dev port |
| --- | --- | --- | --- |
| `apps/landing` | `@ecommerce/landing` | Public marketing site + catalogue teaser | **3069** |
| `apps/shop` | `@ecommerce/shop` | Authenticated shop: browse, cart, checkout, account | **4069** |

This is a **skeleton**: real routes, real components, a real data-fetch shape that calls the backend services
and degrades honestly when they are not up — not a finished product. It owns no `.starciwork` (the backend
repo owns the Work tree, same rule as `todo-app-frontend`) and no auth: the landing → shop session handoff
is a contract the backend lane and a later workstream settle, marked in-source with `// contract:` pointers.

## Ports & env

The example is allocated **offset 69**; the formula is `port = basePort + appSlot*1000 + offset`. Backend
services are owned by the parallel `ex-ms-be` lane and are always read from an env var with a localhost
fallback literal equal to the allocated port — never a hardcoded host in a component:

| env var | service | fallback |
| --- | --- | --- |
| `NEXT_PUBLIC_ORDER_API_URL` | order | `http://localhost:6070` |
| `NEXT_PUBLIC_IDENTITY_API_URL` | identity | `http://localhost:5070` |
| `NEXT_PUBLIC_SHOP_URL` | (this example's shop app) | `http://localhost:4069` |

Each env is read once in the app's `src/modules/config` module (nivo-fe's convention); pages and components
import the resolved constant, not `process.env`.

## Run it

```sh
cd examples/ecommerce-app-fe
npm install

# both apps, concurrently (landing 3069, shop 4069):
npm run dev

# or one at a time:
npm run dev:landing
npm run dev:shop

# typecheck the whole workspace from the root:
npx tsc --noEmit
```

With no backend running, `/browse` and `/account` in the shop render their empty states and name the
unreachable service rather than showing placeholder data — that is the intended behavior of the skeleton.
