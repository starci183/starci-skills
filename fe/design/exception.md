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
- the larger group seam begins only after OR, before the credential form.

The repository contract should be named for this relationship, for example
`auth-shortcuts-over-divider`. `stacked-peer-controls` must not admit Divider to accommodate it.

## Forbidden

| Never | Why | Instead |
|---|---|---|
| Add Divider to the generic peer-control contract for auth | Every ordinary control stack gains an unrelated child | Auth-specific contract |
| Put OR at the same seam as the credential form | It reads as a third independent section | Keep OR with OAuth shortcuts at `gap-3` |
| Copy the auth exception into another screen | An exception is evidence about one relationship, not a new default | Re-evaluate and name a separate contract if warranted |
