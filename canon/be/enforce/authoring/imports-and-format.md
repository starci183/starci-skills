# BE — import order, the `@modules` / `@features` aliases, and formatting

Scope: how to WRITE imports and format a `.ts` file under the backend's `src/**`. The machine
authority is `eslint.config.mjs`, which governs `src/**`; every rule below is taken straight from
that config and from real code, with no outside theory applied. STRICT: eslint is the single source
of truth, and the code must run `npm run lint` clean.

> A note on the root: `.prettierrc` (`singleQuote`, `trailingComma: all`) applies ONLY to the
> `format` script targeting `apps/**` and `libs/**` — it does NOT apply to `src/**`. Inside `src/**`
> eslint rules: **double quotes, no semicolons, indent 4**. Do not let an IDE Prettier quietly
> convert `src/` back to single quotes and semicolons.

---

## 1. Hard formatting (eslint `error` — not up for discussion)

Indent **4 spaces**; **double quotes**; **no semicolons**; one array element and one argument per
line.

```ts
// src/features/.../purchase-ai-subscription.command.ts
export class PurchaseAiSubscriptionCommand {
    constructor(
        readonly params: ExecuteParams<PurchaseAiSubscriptionRequest>,
    ) { }
}
```

```ts
// Wrong: two-space indent, single quotes, a semicolon — the Prettier default, which eslint
// rejects inside src/.
export class PurchaseAiSubscriptionCommand {
  constructor(readonly params: ExecuteParams<PurchaseAiSubscriptionRequest>) {}
}
```

---

## 2. A named import ALWAYS breaks across lines, even for a single name

The rule `object-curly-newline` sets `ImportDeclaration: "always"`, so every `import { … }` opens and
closes its braces on their own lines, one name per line, with a trailing comma. A single-name import
still takes three lines — this is the repo's DOMINANT idiom.

```ts
// src/features/.../purchase-ai-subscription.handler.ts
import {
    ICQRSHandler,
} from "@modules/platform/cqrs/icqrs-handler"
import {
    ActionType,
} from "@modules/databases/postgresql/primary/enums/action-type"
import {
    PaymentType,
} from "@modules/databases/postgresql/primary/enums/payment-type"
import {
    TransactionEntity,
} from "@modules/databases/postgresql/primary/entities/transaction.entity"
import {
    InjectPrimaryPostgreSQLEntityManager,
} from "@modules/databases/postgresql/primary/primary.decorators"
```

```ts
// Wrong: collapsed onto one line — eslint's object-curly-newline flags it.
import { ICQRSHandler } from "@modules/platform/cqrs/icqrs-handler"
import { ActionType, PaymentType, TransactionEntity } from "@modules/databases/postgresql/primary/entities/transaction.entity"
```

The only exception is a **default import**, which has no braces and stays on one line:

```ts
import Stripe from "stripe"
import path from "path"
import SuperJSON from "superjson"
```

---

## 3. A type-only import uses `import type`

An import used only as a type, with no runtime value, is written `import type { … }` — and still
breaks across lines as in §2.

```ts
// src/features/.../purchase-ai-subscription.handler.ts
import type {
    EntityManager,
} from "typeorm"
import type {
    BuildSepayCheckoutParams,
    ResolveCheckoutParams,
    ResolveCheckoutResult,
} from "./types"
```

---

## 4. Crossing modules uses the `@modules/*` alias and names the declaring file

The path aliases in `tsconfig.json` are a single root each: `@modules/*` → `src/modules/*` and
`@features/*` → `src/features/*`. Importing from another capability ALWAYS goes through the alias
**and the file that declares the symbol** — never a folder barrel, never the collapsed short form
(`@modules/winston/...`), and never `../../../modules/...`. Same-capability imports stay relative
(naming-and-structure §3). Grounded 2026-08-05 against
`src/features/api/core/graphql/mutations/ai/purchase-ai-subscription/purchase-ai-subscription.handler.ts`.

```ts
import {
    UserNotFoundException,
} from "@modules/platform/exceptions/errors/users/user"
import {
    DayjsService,
} from "@modules/lib/mixin/dayjs.service"
import {
    RetryService,
} from "@modules/lib/mixin/retry.service"
```

```ts
// Wrong: climbing out to another module, or stopping at a folder barrel.
import { UserNotFoundException } from "../../../../modules/platform/exceptions"
import { DayjsService } from "@modules/mixin"
```

For a type shared WITHIN the same feature, either `@features/<path-to-file>` or a relative `./` or
`../` is idiomatic here — choose by distance (see §5).

---

## 5. Import order: aliases and externals first, relative `./` last — no alphabetising, no blank groups

The repo does NOT insert blank lines between imports and does NOT sort alphabetically. The actual
idiom is: package and alias imports (`@modules`, `@features`, `@nestjs`, npm) come first, and the
surface's own relative `./` and `../` imports come LAST. There is no blank line separating groups.

```ts
// src/features/.../purchase-ai-subscription.service.ts — alias, then nestjs, then relative last
import {
    ExecuteParams,
} from "@features/api/core/types"
import {
    Injectable,
} from "@nestjs/common"
import {
    PurchaseAiSubscriptionCommand,
} from "./purchase-ai-subscription.command"
import {
    PurchaseAiSubscriptionResponseData,
} from "./graphql-types"
```

```ts
// Wrong: relative imports first, with a blank line separating groups — neither matches the repo.
import {
    PurchaseAiSubscriptionCommand,
} from "./purchase-ai-subscription.command"

import {
    Injectable,
} from "@nestjs/common"
```

---

## 6. There is no barrel

`index.ts` is not a public surface. Importers name `./graphql-types/request` and
`./graphql-types/response` (or the `@modules` / `@features` file path) directly. A new
`export * from "./x"` folder is the bug `must-deep-module-import` exists to catch. See
naming-and-structure §3 for why the barrel was retired and what that made public API.
