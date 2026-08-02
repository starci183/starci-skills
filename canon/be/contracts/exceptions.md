# Exceptions — ALWAYS AbstractException (an iron rule)

Source: `src/modules/exceptions/` (errors plus filters) — the infrastructure is already done on
`mtp`: the `httpStatus?` field, the global `APP_FILTER` `AbstractExceptionHttpFilter`, and the
GraphQL `formatError`.

## The rules

1. **Never `throw new Error(...)`.** Real running code under `src/` currently contains **zero**
   occurrences — the only ones left are mocks in `*.spec.ts`. Keep that number where it is.
2. **Never a framework built-in** (`BadRequestException`, `NotFoundException`,
   `UnauthorizedException`, `ForbiddenException`, …) inside `src/modules/**` or
   `src/features/api/**` — including when the backend is edited from an FE lane. The remaining debt
   lives in `features/mock` (teaching demos) and `features/tools`; do not add to it.
3. Every domain error is **its own class extending `AbstractException`**, living at
   `src/modules/exceptions/errors/<domain>/<error-name>.ts` and exported through that domain's
   `index.ts` — and, for a new domain, added to `errors/index.ts`.
4. When an HTTP status other than 500 is needed — a guard or auth case returning 401, 403, 404,
   400 — pass `HttpStatus.*` as the **fourth argument** to `super`. A domain exception normally does
   NOT set it, and the filter defaults to 500. Do not set `httpStatus` on a business error on a whim.

## The anatomy of one exception file — copy this shape

```ts
// src/modules/exceptions/errors/flashcard/flashcard-card-not-found.ts — a real example
import type {
    AbstractExceptionMetadata,
} from "../abstract"
import {
    AbstractException,
} from "../abstract"

/** Metadata for {@link FlashcardCardNotFoundException}. */
export interface FlashcardCardNotFoundExceptionMetadata extends AbstractExceptionMetadata {
    /** Id of the flashcard card that was looked up. */
    flashcardCardId: string
}

/**
 * The requested flashcard card does not exist in the primary database.
 */
export class FlashcardCardNotFoundException extends AbstractException {
    constructor(
        {
            flashcardCardId,
            originalError,
        }: FlashcardCardNotFoundExceptionMetadata,
    ) {
        super(
            `Flashcard card not found: ${flashcardCardId}`,
            "FLASHCARD_CARD_NOT_FOUND_EXCEPTION",
            {
                flashcardCardId,
                originalError,
            },
        )
    }
}
```

All four parts are required:

- **A metadata interface** extending `AbstractExceptionMetadata` — which brings `originalError?` —
  with JSDoc on every field. When there are no fields of its own, write
  `export type XMetadata = AbstractExceptionMetadata` (see `admin-api-key-required.ts`).
- **A constructor taking one metadata object**, destructured. Never positional arguments.
- **A code** in SCREAMING_SNAKE, suffixed `_EXCEPTION`, matching the class name.
- **A message** in English, human-readable, embedding the relevant id.

The guard and auth variant uses the fourth argument:

```ts
super(
    "x-admin-api-key header is required.",
    "ADMIN_API_KEY_REQUIRED_EXCEPTION",
    {
        originalError,
    },
    HttpStatus.UNAUTHORIZED,
)
```

## Throwing at the call site

```ts
throw new FlashcardCardNotFoundException({
    flashcardCardId: cardId,
})

// wrapping an infrastructure failure: keep the original error in the metadata
// (real example: es-sync-user.listener.ts)
const exception = new KafkaCdcMessageException({
    topic,
    originalError: error instanceof Error ? error : undefined,
})
```

Three shapes to reject:

```ts
// Wrong: a bare Error
throw new Error(`Card not found: ${cardId}`)
// Wrong: a framework built-in
throw new NotFoundException("Card not found")
// Wrong: throwing the base class — always throw a subclass
throw new AbstractException("Card not found", "CARD_NOT_FOUND", {})
```

## Why, so nobody breaks it for convenience

- Over REST, `AbstractExceptionHttpFilter` — registered globally as `APP_FILTER` — maps `httpStatus`
  onto the response. GraphQL goes through its own Apollo `formatError`, and the filter SKIPS the
  graphql context; the comment in `abstract-exception-http.filter.ts` explains the double-send crash
  that made this necessary.
- `code` and `metadata` are serialisable (`toJSON` / `fromJSON`), which is what lets a job or a Kafka
  consumer relay an error across process boundaries. A bare `new Error` loses all of that structure.
