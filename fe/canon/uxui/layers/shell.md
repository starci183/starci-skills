# shell

## Definition

A shell wraps a vendor CONTAINER — a primitive whose own API requires children, because it exists to
put something inside itself. A dialog, a drawer, a popover, a tooltip: each of them is a hole the
vendor cuts in the page, and a hole with nothing in it is not a surface.

It is a branch. It takes `children`, it knows no domain, and the slot is the tier exactly as it is
everywhere else. What separates it from every other branch is one permission: **a shell may import
the component library, and no other branch may.**

That permission exists because the alternative does not: a covering surface owes a focus trap, an
escape key, a scroll lock, an inert page behind it, a returned focus, a backdrop and a placement.
None of that is arrangement, none of it can be written at a tier that has no vendor, and each piece
is a browser behaviour that changes underneath whoever reimplements it.

The question that settles it: **does the vendor primitive you are wrapping require children?** If
yes, it is a shell. If it takes only values, it is a leaf. If there is no vendor primitive at all,
it is a branch.

## Why this is a folder and not a rule

An exemption written as a folder is a policy, and it can be counted, browsed and argued with. The
same exemption written as a list inside a lint rule is visible only to somebody who opens the
plugin.

It also makes the boundary checkable in BOTH directions, which is what stops this folder becoming
the place difficult things go:

- a file outside `leaves/` and `shells/` that imports the library is in the wrong folder;
- a file **inside** `shells/` that imports no library is not a shell — it is an ordinary branch, and
  it belongs with the others.

A folder nobody can enter by accident is a policy. A folder anybody can opt into is a hole.

## Rules

**SHELL-1 · It wraps ONE vendor container, and renders it through.**

The same monopoly a leaf has, over a different kind of primitive. Everything above asks a shell for
covering behaviour rather than reaching for the library, which is what keeps "what would changing
component libraries cost" answerable by listing two folders rather than reading the whole tree.

**SHELL-2 · It takes `children` because the vendor does, and it arranges none of them.**

Children go straight into the vendor's own slot. A shell that places two pieces of content relative
to each other has stopped being a wrapper — that arrangement belongs to a contract key, held by
whoever composes the shell.

**SHELL-3 · It carries no title, no copy and no domain.**

What a surface SAYS belongs to whatever is mounted inside it. The same shell carries a sign-in panel
today and a confirmation tomorrow without learning a word about either, and a shell that knows one
of them cannot hold the other.

**SHELL-4 · It owns the behaviour the vendor owns, and states which.**

Focus in and back out, escape, the backdrop, the scroll lock, the placement. These are the reason
the tier exists, so a shell names them where a reader will look — not because the list is
surprising, but because the day somebody proposes hand-rolling one of them, the list is the answer.

**SHELL-5 · Whether it is open is not its decision.**

A shell is told. Whoever mounts it owns the situation that opened it, and owns what happens when it
succeeds — a flag says nothing about either. This is the one place a shell's props look like an
overlay's and mean something different: the overlay owns the intent, the shell owns the mechanics.

**SHELL-6 · A leaf that grows children has become a shell, and moves.**

There is no such thing as a leaf with a slot. When a vendor primitive turns out to need children,
the file changes folder rather than the tier changing definition — the alternative is a word that
stops meaning what it says, and a reader who has to be told that a leaf is not a leaf.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A shell that imports no vendor library | It is an ordinary branch wearing an exemption it does not need | Move it to `branches/` |
| A branch outside this folder importing the library | The boundary stops being two folders and becomes a judgement per file | Wrap the primitive here, and compose it there |
| Arranging the children | The arrangement then lives outside the contract table, findable by nobody | Let whoever composes the shell hold them in a key |
| A title, a label or any copy | The shell can then hold one kind of content and not another | Take it from what is mounted inside |
| Owning whether it is open | Whoever opened it knows why, and a flag carries none of that | Be told; report dismissal |
| Hand-rolling the covering behaviour to avoid the vendor | Focus, inertness, scroll lock and placement are browser behaviour that changes underneath you | Use the vendor, once, here |
| A second shell for the same primitive | Two wrappers for one thing drift, and the second is always the one nobody updates | One shell per primitive |

## Examples

### The ordinary case — mechanics only

```tsx
// shell: every element is the vendor's compound, and the children go into its own slot.
export const ModalShell = ({ props, on, children }: ModalShellProps) => (
    <Modal isOpen={props.isOpen} onOpenChange={(open) => { if (!open) on?.dismiss?.() }}>
        <Modal.Backdrop>
            <Modal.Container size={props.size ?? "md"} placement="center">
                <Modal.Dialog>
                    <Modal.CloseTrigger />
                    <Modal.Body>{children}</Modal.Body>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    </Modal>
)
```

```tsx
// Wrong: the same file deciding how the inside sits. That seam now exists outside the contract
// table, where nobody looking for it will find it.
<Modal.Body>
    <div className="flex flex-col gap-4">{children}</div>
</Modal.Body>
```

They differ in one thing: whether the shell arranged anything.

### The boundary test, both ways

```tsx
// shells/ModalShell: imports the library, so the folder is earned
import { Modal } from "@heroui/react"
```

```tsx
// shells/SurfaceCard: imports nothing from the library, so it is a branch in the wrong folder
import { Tree } from "@/components/branches/Tree"
```

They differ in one thing: whether the exemption is being used.

### The domain trap

```tsx
// shell: it never learns what it is covering the page for.
<ModalShell props={{ isOpen }} on={{ dismiss }}>
    <AuthenticationPanel />
</ModalShell>
```

```tsx
// Wrong: a title makes this the sign-in shell, and the confirmation it should also carry now
// needs a second one.
<ModalShell props={{ isOpen, title: t("signIn") }} on={{ dismiss }} />
```

They differ in one thing: whether the next surface can reuse it.

### The promotion

```tsx
// A leaf whose vendor turned out to need children does not gain a slot. It moves.
leaves/ModalShell  ->  shells/ModalShell
```

```tsx
// Wrong: the tier keeps the file and loses its meaning, and every reader afterwards has to be
// told that a leaf is not a leaf.
export type ModalShellProps = LeafProps<ModalShellData> & { readonly children?: ReactNode }
```

They differ in one thing: whether the word still says what it means.
