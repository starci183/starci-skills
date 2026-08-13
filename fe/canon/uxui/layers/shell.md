# shell

## Definition

A shell owns vendor interaction mechanics while deliberately ignoring the product shape inside.
This system has exactly three: `ModalShell`, `DrawerShell`, and `DropdownShell`.

They earn the only public React `children` holes because their job is to pass uninterpreted content
through vendor mechanics. Modal and drawer own focus trapping, Escape, backdrop, scroll lock,
inertness and focus return. Dropdown owns trigger/popover/menu focus, placement and keyboard
navigation. Copy, account state and the meaning of menu choices are never shell concerns.

A vendor primitive requiring children does not automatically create a shell. Card, accordion,
list and tooltip composition still has a visible product shape and therefore belongs to a leaf or
a named branch using `contract + render`. Dropdown is admitted because its trigger and menu items
must share one vendor focus/selection machine while the owning block decides what those items mean.

## Rules

**SHELL-1 · Only `ModalShell`, `DrawerShell`, and `DropdownShell` are shells.** The list is closed;
`shells/` is not a folder-wide escape hatch.

**SHELL-2 · A shell may own the vendor body only as scroll mechanics.** ModalShell wraps `children`
once in `Modal.Body className="p-0"`: the body preserves scrolling, while zero inset leaves all
arrangement to the mounted contract. It never counts children, reads them, or chooses their contract.

**SHELL-3 · It owns mechanics only.** No title, copy, domain hook, fetch or decision about why it is
open.

**SHELL-5 · Dropdown content belongs to the block that names the function.** `DropdownShell` exposes
trigger, section and item mechanics without importing domain copy. A menu such as `AccountMenu`
is a block: it decides which choices exist and what actions they report, then composes the shell.

**SHELL-4 · It imports the vendor covering primitive.** Without that mechanics ownership it is an
ordinary branch in the wrong folder.

## Forbidden

| Never | Instead |
|---|---|
| `PopoverShell`, `TooltipShell`, `CardShell` | Use the closed DropdownShell only for a real menu machine; otherwise use a leaf or named branch |
| Domain `AccountMenu` filed as a leaf | A block over `DropdownShell` |
| Layout around `children` | Put layout in a contract rendered by the caller |
| Domain copy or state | Keep intent in the overlay/block that mounts the shell |
| A shell with no vendor import | Move it to `branches/` |

## Example

```tsx
export const ModalShell = ({ isOpen, onDismiss, children }: ModalShellProps) => (
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open) onDismiss() }}>
        <Modal.Backdrop>
            <Modal.Container>
                <Modal.Dialog>
                    <Modal.CloseTrigger />
                    <Modal.Body className="p-0">{children}</Modal.Body>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    </Modal>
)
```

The shell knows how the covering surface behaves and nothing about what is mounted inside it.
