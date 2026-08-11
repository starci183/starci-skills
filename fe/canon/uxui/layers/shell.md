# shell

## Definition

A shell owns covering mechanics while deliberately ignoring the shape inside. This system has
exactly two: `ModalShell` and `DrawerShell`.

They earn the only public React `children` hole because their job is to pass an uninterpreted
interior straight into the vendor dialog root. They arrange none of it. Focus trapping, Escape, backdrop,
scroll lock, inertness, placement and focus return are the shell's concern; copy and content shape
are not.

A vendor primitive requiring children does not automatically create a shell. Card, accordion,
list, popover and tooltip composition still has a visible shape and therefore belongs to a leaf or
a named branch using `contract + render`.

## Rules

**SHELL-1 · Only `ModalShell` and `DrawerShell` are shells.** The list is closed; `shells/` is not a
folder-wide escape hatch.

**SHELL-2 · A shell passes `children` directly to the vendor dialog root.** It never forces them
through `Modal.Body`, wraps them in layout, counts them, reads them, or chooses their contract.

**SHELL-3 · It owns mechanics only.** No title, copy, domain hook, fetch or decision about why it is
open.

**SHELL-4 · It imports the vendor covering primitive.** Without that mechanics ownership it is an
ordinary branch in the wrong folder.

## Forbidden

| Never | Instead |
|---|---|
| `PopoverShell`, `TooltipShell`, `CardShell` | A leaf for a closed primitive, or a named branch with `contract + render` |
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
                    {children}
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    </Modal>
)
```

The shell knows how the covering surface behaves and nothing about what is mounted inside it.
