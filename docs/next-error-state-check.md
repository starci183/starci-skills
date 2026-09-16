# Next error-state code check

`checks/code-patterns/next-errors.mjs` implements three adopted mechanical rules for a selected Next application. It reads source and installed declarations; it never executes application code or a provider.

## Rules

- `FE_ERROR_ENVELOPE_POLICY` binds an explicitly selected transport envelope type and its readers. The envelope exposes a boolean success discriminator, data and failure fields. Each reader handles transport failure before returning data. `emptyData: valid` may return `data ?? null`; `emptyData: required` proves an explicit missing-data throw. A normal business disposition such as `pending` or `refused` remains data.
- `FE_WRITE_FEEDBACK_OWNER` binds a resolved write action, feedback owner and every selected site. Every call of that action in the covered source roots belongs to a declared site and flows through the resolved feedback owner. A local same-named function does not satisfy the rule. Passing or storing an action through an unsupported dynamic shape makes coverage unavailable.
- `FE_NEXT_ERROR_BOUNDARY_LOCATION` checks only explicitly declared global or segment boundaries. It verifies the reserved Next filename, `use client`, typed `error` and recovery props, a reachable recovery action and the global HTML shell. The permitted recovery prop is read from the installed Next error-boundary declarations, so the checker does not assume `reset` when the installed contract uses `unstable_retry`.

These rules do not require GraphQL, Apollo, SWR, a toast, or a boundary in every route folder. The application contract selects the mechanisms that actually apply. Retry eligibility, user copy, redaction, telemetry and whether a write warrants feedback remain design review obligations.

## Project contract

The target `package.json` owns `starci.codePatterns.next.errorState`:

```json
{
  "sourceRoots": ["src"],
  "transports": [
    { "root": "src/api", "mode": "envelope", "envelopeIds": ["read"] }
  ],
  "envelopes": [
    {
      "id": "read",
      "type": { "path": "src/api/envelope.ts", "export": "ReadEnvelope" },
      "discriminator": { "field": "ok", "success": true },
      "dataField": "data",
      "errorFields": ["error"],
      "readers": [
        { "path": "src/api/read.ts", "export": "readCourse", "emptyData": "valid" }
      ]
    }
  ],
  "writes": [
    {
      "action": { "path": "src/api/write.ts", "export": "saveCourse" },
      "feedback": { "path": "src/ui/feedback.ts", "export": "withFeedback" },
      "sites": [{ "path": "src/features/save.ts", "export": "saveFromForm" }]
    }
  ],
  "boundaries": [
    {
      "role": "global",
      "routeRoot": "src/app",
      "path": "src/app/global-error.tsx",
      "recoveryProp": "reset"
    }
  ]
}
```

Paths are normalized repository-relative regular files and every named export is resolved through the owning TypeScript program. The parent supplies the canonical architecture config. All owning-program sources below `sourceRoots` must appear in the exact selected/context set; otherwise omission detection is unavailable and the check fails closed. `transports` records whether a selected root uses a typed envelope or throws transport failures. It does not turn all negative business outcomes into exceptions.

The uniform adapter is:

```js
checkNextErrors({ root, files, contextFiles, ruleIds, architectureConfig })
```

It returns `starci/code-pattern-script@1`. `checkedRuleIds` stays empty when contract, compiler, installed Next or static source proof is unavailable.

## Why the contract is conditional

The reference application's older rule text combined two different facts: some GraphQL reads returned `null`, while required payloads threw. The portable rule draws the boundary at transport failure versus valid empty domain data. It also binds feedback to selected writes rather than imposing a toast on every mutation.

Primary references reviewed 2026-09-16:

- [SWR error handling](https://swr.vercel.app/docs/error-handling) keeps fetcher failures distinct from returned data and permits error plus stale data.
- [SWR conditional fetching](https://swr.vercel.app/docs/conditional-fetching) and [arguments](https://swr.vercel.app/docs/arguments) describe request availability and identity; they do not prescribe a GraphQL envelope.
- [Next error handling](https://nextjs.org/docs/app/getting-started/error-handling) assigns expected errors to explicit UI state and uncaught render failures to route error boundaries.
- [Apollo error policies](https://www.apollographql.com/docs/react/data/error-handling) show that partial data/error behavior is a selected client policy, rather than a universal throw-or-null rule.

## Static limits

The check proves declared symbols, direct/awaited calls, simple result bindings, envelope branches and boundary structure. Higher-order action registries, reflective invocation, computed envelope fields or unsupported control-flow indirection produce typed unavailable errors. It cannot judge retry safety, message quality, security redaction, telemetry usefulness or business-state meaning.
