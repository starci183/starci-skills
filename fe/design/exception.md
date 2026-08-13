# exception

## Definition

An exception is a named layout whose correct seam differs from the reusable rule because the screen
contains a relationship the generic shape does not express. It is recorded here so the exception
stays local instead of silently widening the shared contract.

## Rules

**EXCEPTION-1 · An exception gets its own contract key.**

Never add another admitted child to a generic contract merely because one screen needs it. That
turns a local relationship into permission everywhere. Name the exceptional composition, state its
reason, and keep the generic contract closed.

**EXCEPTION-2 · OAuth shortcuts and OR are one cluster.**

In authentication, the OAuth buttons and the labelled OR divider together describe the alternative
entry path. OR closes the shortcut choice; it does not begin the credential form. Therefore:

- OAuth controls and OR live under one auth-specific contract;
- the seam from the shortcuts to OR is `gap-3`;
- the two rules and the OR label inside the divider also use `gap-3`;
- OAuth-with-OR and the credential form are the two children of one auth-entry contract, and their
  seam is exactly one `gap-3`;
- the outer page column sees that auth-entry contract as one child, so its group rhythm cannot add a
  second gap between OR and the form.

The repository contract pair should be named for these relationships, for example
`auth-entry-stack` and `auth-shortcuts-over-divider`. `stacked-peer-controls` must not admit Divider
to accommodate them.

**EXCEPTION-3 · Auth content meets the modal scroll body without an outer inset.**

The modal body already defines the covering and scrolling boundary. The projected authentication
panel owns its sole `centred-page-column` host, so the overlay must mount that projection through
`ContractContent`, not another `Tree`. `centred-page-column` carries no vertical padding; its named
child contracts own every visible seam. This prevents both a second contract host and the two empty
padding bands above and below the form.

**EXCEPTION-4 · StarCi Academy says `content`, never `lesson`.**

In StarCi Academy, `content` is the reader-facing product term for a unit of learning. `lesson` may
remain in an upstream API field, GraphQL type, database name or integration boundary, but it must be
translated to `content` in the connected block before copy reaches a pure component. Therefore:

- English visible copy says `Content`, never `Lesson`;
- Vietnamese visible copy says `Nội dung`, never `Bài học` when naming this product concept;
- translation keys and resolved UI discriminants use `content`;
- API and persistence names may stay `lesson` only when changing them would alter an external or
  stored contract.

## Forbidden

| Never | Why | Instead |
|---|---|---|
| Add Divider to the generic peer-control contract for auth | Every ordinary control stack gains an unrelated child | Auth-specific contract |
| Let OAuth and the form be page-column siblings | The outer rhythm adds a second gap after OR | Wrap both in `auth-entry-stack`; it alone owns `gap-3` |
| Copy the auth exception into another screen | An exception is evidence about one relationship, not a new default | Re-evaluate and name a separate contract if warranted |
| Wrap the auth projection in another `Tree` | The same contract and spacing are mounted twice | Project it with `ContractContent` |
| Add vertical padding to `centred-page-column` | The modal gains empty bands outside its named content rhythm | Let its child contracts own the seams |
| Let an API `lesson` name reach StarCi Academy copy | Infrastructure vocabulary replaces the product's chosen concept | Map it to `content` at the connected boundary |
