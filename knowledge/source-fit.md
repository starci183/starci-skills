# Source fit and effective contracts

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.source-fit` |
| Operators | `source-fit` |
| Search tags | `source contract, effective contract, reuse, extend, create, grammar gap` |
| Dependencies | `fe.grammar-common-overview` plus the selected Grammar overview and exact object/case guides |

## Record

Resolve every approved Block against exported source contracts without asking the model to infer how a base contract and local delta combine.

## Effective contract

Source-context export resolves and hashes:

```text
baseRef + baseHash + allowed extension axes + source delta
  -> effectiveRef + effectiveHash
```

The base contract owns slots, state inputs, variable axes, extension policy, and closed invariants. The effective contract is the only source shape used for fit decisions.

## Verdicts

- `reuse`: an exact effective contract satisfies the responsibility with no source delta.
- `extend`: a lower-tier contract exposes the required named axis and the delta changes only that axis.
- `create / create-block-or-above`: application source may create an owned Block, layout, or page around exact reusable lower-tier owners.
- `create / grammar-gap`: a reusable leaf, branch, composite, complex case, or extension axis is missing. Emit a Grammar request and block local reconstruction.

Every create verdict declares a stable request path before source writes. Reject approximate lookalikes, arbitrary `className` escape hatches, anatomy changes presented as extensions, unresolved base hashes, and package-missing conditions disguised as local components.
