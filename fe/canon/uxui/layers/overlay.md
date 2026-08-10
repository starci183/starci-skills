# overlay

## Definition

An overlay is **interaction topology that knows the domain**. It takes `children` and it arrives in
response to something the reader did: a dialog asking them to confirm, a drawer holding a filter, a
command surface. Open and domain-aware — the same pair as a layout, differing in one thing: a layout
survives navigation, an overlay is summoned and dismissed.

A `Modal` is NOT an overlay. It is a branch: it holds whatever it is given and knows nothing. The
overlay is `SignInOverlay` — the file that knows this dialog is about signing in, what it must ask
for, and what happens when it succeeds.

The question that settles it: **does it come and go in response to an action?** If yes and it knows
the domain, it is an overlay. If it stays while the body changes, it is a layout. If it knows nothing
about what it holds, it is a branch.

## Rules

**OVERLAY-1 · The container is a branch; the overlay composes it.**

Focus trap, escape key, scroll lock, backdrop, returned focus, `role="dialog"` — none of that is the
overlay's work. It belongs to a leaf that wraps the vendor, held by a branch that arranges the parts.
The overlay supplies the domain and the children.

**OVERLAY-2 · It owns whether it is open, and it owns why.**

The open flag is the overlay's, not a caller's boolean threaded through three components. Whoever
opens it does so through a named intent — "the reader asked to sign in" — rather than by setting a
flag, because a flag says nothing about what should happen when the dialog succeeds.

**OVERLAY-3 · Dismissal always has three routes, and all three do the same thing.**

Escape, the backdrop, and the close control. An overlay where one of the three does something
different is one a reader escapes from by accident and loses work in.

**OVERLAY-4 · Focus goes in and comes back.**

Focus moves into the overlay when it opens and returns to whatever summoned it when it closes.
This is not polish: without the return, a keyboard reader is dropped at the top of the document
every time they cancel anything.

**OVERLAY-5 · It resolves its own domain, exactly like a block.**

Its request, its words, its states. An overlay taking a fetched payload as a prop makes whoever
opened it responsible for the dialog's data, and that caller is usually a button.

**OVERLAY-6 · It reports an outcome, never a raw event.**

`on.succeeded`, `on.cancelled`. Not `on.close(reason)` with the caller decoding what happened. The
overlay knows what happened; the caller only needs to know which of the outcomes occurred.

**OVERLAY-7 · What it interrupts, it must be worth interrupting for.**

An overlay takes the whole screen's attention and blocks everything behind it. A surface that could
have been rendered in place — a hint, an inline panel, a section — should be, and the choice between
them is settled in the pattern shelf rather than reargued per feature.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Importing `@heroui/react` for dialog behaviour | The vendor boundary belongs to the leaves, and a dialog is where it is most often lost | Use the leaf that wraps it, held by the branch that arranges it |
| Accepting an arbitrary `ReactNode` as its whole body | An overlay that accepts anything owns nothing, and its rules stop being checkable | Expose typed slots and a finite set of sizes |
| Taking `isOpen` from a caller as a plain boolean | The caller then owns a state it cannot reason about, and success has nowhere to go | Own the state; take a named intent to open |
| Making escape, backdrop and close behave differently | A reader dismisses by accident and loses what they typed | One dismissal path, three ways to reach it |
| Leaving focus where it was | Keyboard readers are dropped at the top of the document on every cancel | Move focus in on open, return it on close |
| Taking a fetched payload as a prop | Whoever opened it — usually a button — becomes responsible for its data | Fetch it here |
| Reporting a raw event upward | The caller has to decode what happened, and two callers will decode it differently | Report the outcome by name |
| Using an overlay for something that fits in place | It blocks everything behind it for content that never needed to | Render it in the surface it belongs to |

## Examples

### The ordinary case — a dialog that knows what it is for

```tsx
// overlay: the branch holds the topology, the leaf holds the vendor, and this file supplies the
// domain and reports an outcome by name.
export const SignInOverlay = ({ props, on }: SignInOverlayProps) => {
    const t = useTranslations("auth")
    const panel = useAuthPanel()
    return (
        <Modal props={{ isOpen: props.isOpen, label: t("signIn") }} on={{ dismiss: on?.cancelled }}>
            <AuthenticationPanel on={{ succeeded: on?.succeeded }} />
        </Modal>
    )
}
```

```tsx
// Wrong: it reaches for the vendor itself, so the focus trap and the aria wiring now live at a
// tier that is supposed to know only about this dialog's meaning.
import { Modal as HeroModal } from "@heroui/react"

export const SignInOverlay = ({ isOpen }: { isOpen: boolean }) => (
    <HeroModal isOpen={isOpen} className="p-6"><AuthenticationPanel /></HeroModal>
)
```

They differ in one thing: whether the vendor boundary is still at the leaves.

### The outcome trap

```tsx
// overlay: the caller learns WHAT happened.
type SignInOverlayActions = {
    readonly succeeded?: () => void
    readonly cancelled?: () => void
}
```

```tsx
// Wrong: the caller learns that something closed, and has to decode why. Two callers will decode
// it two ways, and one of them will treat a cancel as a success.
type SignInOverlayActions = {
    readonly close?: (reason: string) => void
}
```

They differ in one thing: who has to interpret what happened.

### The open-state trap

```tsx
// overlay: opened by a named intent, so success has somewhere to go.
const auth = useAuthOverlay()
<Button props={{ label: t("signIn") }} on={{ press: () => auth.open({ then: "resumeCheckout" }) }} />
```

```tsx
// Wrong: a boolean threaded through three components. Nothing records why it was opened, so the
// dialog cannot do the right thing when it succeeds.
const [open, setOpen] = useState(false)
<SignInOverlay isOpen={open} onClose={() => setOpen(false)} />
```

They differ in one thing: whether the reason for opening survives until the outcome.
