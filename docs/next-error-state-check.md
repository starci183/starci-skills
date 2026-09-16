# Next error-state code check

`checks/code-patterns/next-errors.mjs` implements three adopted mechanical rules for a selected Next application. It reads source and installed declarations; it never executes application code or a provider.

## Rules

- `FE_ERROR_WORLD_STATE_MAPPING` binds a resolved world/data source call to one connected owner, a closed failure-state contract and the actual render symbol/state prop that consumes it. Every reachable render of that symbol must carry the proven failure mapping; mutable state provenance and statically unreachable source/render paths fail unavailable. The render function may be local in the same file; no Base twin or extra file is required. Calls outside the declared owner and dynamic source aliases fail closed. `FE_WORLD_OWNER_RENDER_BOUNDARY` remains the separate architecture proof that selected world ownership does not leak into presentation.
- `FE_ERROR_ENVELOPE_POLICY` binds an explicitly selected transport envelope type and its readers. The envelope exposes a boolean success discriminator, data and failure fields. Each reader handles transport failure before returning data, and mutable aliases cannot supply data provenance. `emptyData: valid` may return `data ?? null`; `emptyData: required` proves an explicit missing-data throw. A normal business disposition such as `pending` or `refused` remains data.
- `FE_WRITE_FEEDBACK_OWNER` binds a resolved write action, feedback owner and every selected site. Every reachable call of that action in the covered source roots belongs to a declared site and flows through the resolved feedback owner using the selected `promise` or `callback` binding. A promise is passed before it is awaited, so rejection remains visible to the owner. A callback owner must reachably invoke its operation parameter. A local same-named function does not satisfy the rule. Passing or storing an action through an unsupported dynamic shape makes coverage unavailable.
- `FE_NEXT_ERROR_BOUNDARY_LOCATION` checks only explicitly declared global or segment boundaries. It verifies the reserved Next filename, `use client`, typed `error` and recovery props, a reachable recovery action and the global HTML shell. The permitted recovery prop is read from the installed Next error-boundary declarations, so the checker does not assume `reset` when the installed contract uses `unstable_retry`.

These rules do not require GraphQL, Apollo, SWR, a toast, or a boundary in every route folder. The application contract selects the mechanisms that actually apply. Retry eligibility, user copy, redaction, telemetry and whether a write warrants feedback remain design review obligations.

## Project contract

The target `package.json` owns `starci.codePatterns.next.errorState`:

```json
{
  "schema": "starci/next-error-state@1",
  "sourceRoots": ["src"],
  "worldMappings": [
    {
      "id": "course",
      "owner": { "path": "src/features/course-owner.tsx", "export": "CourseOwner" },
      "source": { "path": "src/api/use-course.ts", "export": "useCourseWorld" },
      "failurePath": "query.error",
      "state": { "path": "src/ui/course-view.tsx", "export": "CourseState" },
      "failureState": "failed",
      "render": { "path": "src/ui/course-view.tsx", "symbol": "CourseView", "stateProp": "state" }
    }
  ],
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
      "binding": "promise",
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

The check proves declared symbols, reachable direct call paths, immutable promise/callback and state/data provenance, source-to-state mapping on every selected render, envelope branches and boundary structure. Statically dead proof sites, higher-order registries, reflective invocation, computed envelope fields or unsupported control-flow indirection produce typed unavailable errors. It cannot judge retry safety, message quality, security redaction, telemetry usefulness or business-state meaning.
