# Source fit and effective contracts

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.source-fit` |
| Contract revision | `7.6.0` |
| Operators | `fe/request-compile` |
| Search tags | `source contract, effective contract, reuse, extend, create, grammar gap` |
| Dependencies | `fe.grammar-common-overview` plus the selected Grammar overview and exact object/case guides |

## Internal guidance

Resolve every approved Block against exported source contracts during compile/apply without asking the
model to infer how a base contract and local delta combine. This record creates no source-fit stage,
approval checkpoint, or route.

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
- `create / grammar-gap`: a reusable rule, token, leaf, branch, composite, complex case, state, or
  extension axis is missing. Bind `fe.grammar-common-extension`: emit the exact Grammar-owner
  repair/publish request, block local reconstruction/CSS improvisation, and recompile only after the
  new package identity is available.

Every create verdict declares a stable request path before source writes. Reject approximate lookalikes, arbitrary `className` escape hatches, anatomy changes presented as extensions, unresolved base hashes, and package-missing conditions disguised as local components.
