# Overlays and feedback — how to WRITE the code (not the design)

Scope: how to open and close an overlay (modal, drawer, alert dialog) and how to raise feedback (a
toast) in the FE app — the repo's real code idiom. Nothing here is about shape or spacing.

---

## 1. Opening and closing an overlay goes through the overlay store, never a local useState

Every global overlay has one key in `OverlayKey` and one accessor `useXxxOverlayState()`. A
component does NOT keep its own `useState(false)` for its modal or drawer; it takes
`{ isOpen, setOpen, open, close }` from the hook.

```tsx
// src/components/modals/LanguageModal/index.tsx
const { isOpen, setOpen } = useLanguageOverlayState()
return <ModalShell isOpen={isOpen} onOpenChange={setOpen} title={t("settings.language.title")}>
```

```tsx
// Wrong: local state for a global overlay — nothing else can open it.
const [isOpen, setIsOpen] = useState(false)
```

Adding a new overlay means adding the key to BOTH the `OverlayKey` union and the `OVERLAY_KEYS`
array (`src/hooks/zustand/overlay/store.ts`), then exporting an accessor in `hooks.ts`. Miss one and
the store is out of step.

---

## 2. An overlay that needs a payload overrides `open(payload)` in its accessor — no prop drilling

Overlays are mounted once inside `ModalContainer` or `DrawerContainer` and receive no props, so data
reaches a modal through the store: stash the context, then open. The accessor overrides `open` to
take the payload.

```tsx
// src/hooks/zustand/overlay/hooks.ts — usePaymentOverlayState
const open = useCallback((next: PaymentContext) => {
    setPaymentContext(next)
    openOverlay("payment")
}, [setPaymentContext, openOverlay])
return { ...base, open, context }
```

The caller writes `openPayment({ flow: PaymentFlow.CoursesCheckout, courseIds, lines })`
(`MiniCartDrawer`), and the modal reads `context` from the same hook.

`useAdModalOverlayState`, `useCvPreviewOverlayState`, and `useFollowListOverlayState` follow the same
shape. Do not try to pass a payload down to a modal as props — the modal has nowhere to receive it.

---

## 3. Opening an overlay outside React is `useOverlayStore.getState()`, and only when genuinely outside

Inside a component or hook, ALWAYS use the accessor. Only code running outside the React tree — an
Apollo link, a pure util — calls `getState()`.

```tsx
// src/modules/api/graphql/clients/links/error.ts — the Apollo ErrorLink
useOverlayStore.getState().openOverlay("maintenance")
```

```tsx
// Wrong: getState() inside a component drops the subscription, so nothing re-renders.
// Use usePaymentOverlayState().open instead.
const onClick = () => useOverlayStore.getState().openOverlay("payment")
```

---

## 4. A standard modal is `ModalShell` — do not hand-roll the `<Modal>` tree

An ordinary modal — close trigger, header, body — is built with `ModalShell`
(`src/components/blocks/layout/ModalShell`), passing `isOpen` and `onOpenChange` plus `title` and
`description` (or a custom `header`). Do not write `Modal > Backdrop > Container > Dialog` yourself.

```tsx
// src/components/modals/LanguageModal/index.tsx
<ModalShell isOpen={isOpen} onOpenChange={setOpen} title={t("settings.language.title")}>
    <div className="flex flex-col gap-6">…</div>
</ModalShell>
```

There is one documented exception: a non-standard shape — no close trigger, a custom backdrop — may
keep its own `<Modal>` tree. For a long body use `scroll="inside"`; `ModalShell` adds the
`max-h-[85vh]` itself, so do not set a max height by hand.

---

## 5. A drawer is a hand-built `Drawer.*` tree (there is no DrawerShell yet) — keep the element order

The repo has no DrawerShell equivalent to ModalShell, so a drawer builds the `Drawer` tree directly.
It still takes its open state from the overlay hook and still follows
`Backdrop > Content > Dialog > (Header/Body/Footer)`.

```tsx
// src/components/drawers/MiniCartDrawer/index.tsx
const { isOpen, setOpen } = useMiniCartOverlayState()
<Drawer>
  <Drawer.Backdrop isOpen={isOpen} onOpenChange={setOpen} className="backdrop-blur-sm">
    <Drawer.Content placement={isMobile ? "bottom" : "right"}>
      <Drawer.Dialog>… <Drawer.CloseTrigger /> <Drawer.Header/> <Drawer.Body/> <Drawer.Footer/> …</Drawer.Dialog>
```

Note that `isOpen` and `onOpenChange` sit on `Drawer.Backdrop`, whereas a Modal takes them on the
root `<Modal>`. That is the vendor's API; do not swap them.

---

## 6. Confirming a destructive action is `ConfirmDialog`, and confirm does NOT close by itself

An irreversible action — cancelling an enrolment, deleting a submission — uses the `ConfirmDialog`
block (`src/components/blocks/feedback/ConfirmDialog`), built on `AlertDialog`. Never
`window.confirm`, and never a hand-built `AlertDialog`.

The confirm button does not close the dialog: `onConfirm` runs the action and the caller closes it
through `onOpenChange`, keeping it open while `isConfirming`.

```tsx
// the block's contract — ConfirmDialog/index.tsx
<ConfirmDialog isOpen={isOpen} onOpenChange={setOpen} tone="danger"
  title="Xoá bài nộp này?" confirmLabel="Xoá bài nộp"
  isConfirming={isPending} onConfirm={handleDelete} />
```

Use `tone="danger"` for a delete or undo (danger button, danger icon); leave the default `"default"`
for anything benign.

```tsx
// Wrong: use ConfirmDialog.
if (window.confirm("Chắc chưa?")) handleDelete()
```

---

## 7. Toasts are imported from `@/modules/toast/toast`, not from the vendor package

Status toasts go through the app wrapper — `toast.success | danger | warning | info` — which inserts
the standard Phosphor indicator. Importing the vendor's `toast` directly loses that canonical
indicator.

```tsx
// src/components/features/profile/CvSubmission/index.tsx
import { toast } from "@/modules/toast/toast"
toast.danger(t("uploadError"))
```

```tsx
// Wrong: bypasses the wrapper, so the indicator is inconsistent.
import { toast } from "@heroui/react"
```

---

## 8. Toasts around a mutation or write are `useGraphQLWithToast` / `useRestWithToast`, never hand-rolled

Every GraphQL or REST write is wrapped in the existing runner, which toasts success and error with
localisation applied, and returns a `boolean` or `T | null` to branch on. Hand-written toasts (§7)
are for feedback that exists outside a response — client-side validation, a file-read failure.

```tsx
// src/components/features/cart/hooks/useCart.ts and .../community/CommunityComposer/index.tsx
const runGraphQL = useGraphQLWithToast()
const ok = await runGraphQL(() => mutateSomething(request))
if (ok) { … }
```

For REST and uploads: `const runRest = useRestWithToast()` then
`runRest(() => axios.put(presignedUrl, file))`.

Writing your own try/catch with `toast.success` / `toast.danger` around a mutation duplicates the
runner's logic and is where the localisation and the unauthorized branch get forgotten.

To silence the toast on one branch, pass `runGraphQL(action, { showSuccessToast: false })`; to
change the success copy, pass `{ successMessage }`. Do not rewrite the try/catch loop.
