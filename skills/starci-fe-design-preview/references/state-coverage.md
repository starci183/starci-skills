# State coverage

State completeness is evaluated by the owner that can change, not by one flat page checklist.

| Owner | Candidate states to classify |
|---|---|
| `block` | loading, empty, populated, recoverable error, terminal/unavailable error, pending action, disabled action, optimistic/stale state, keyboard/focus where interactive |
| `page` | route entry, authenticated/guest redirect, page orchestration loading, partial availability, full content, page-level failure only when the page owns it |
| `layout` | desktop/mobile, guest/authenticated, active navigation, overflow/collapse, light/dark, persistent loading only for layout-owned data |
| `overlay` | trigger/closed context, opening, open, validation error, submitting, success, backend error, dismissal and focus return |

Only classify states that the product and owner can enter. For each candidate use:

```json
{
  "ownerId": "block-daily-quest",
  "state": "loading",
  "coverage": "rendered | covered-by | not-applicable",
  "scenarioId": "case-a-loading",
  "evidence": "query state or reason it cannot occur"
}
```

## Volume and arrival

The table above classifies what an owner can BE. These cells classify what it is given, and they are
not optional additions to it: a candidate approved without them is approved at the one volume its
fixture happened to hold.

| Cell | What only this cell can show |
|---|---|
| nothing | whether the region collapses, or titles an emptiness |
| one item | whether a grid of one reads as a mistake |
| several items of uneven length | whether peers still align — a row of cards whose actions land at three heights reads as three different kinds of offer |
| exactly one page of items | whether page furniture that depends on a count disappears at the boundary |
| more than one page | whether the pager, its window and the page-to-request conversion are real |
| an answer that lands AFTER first paint | whether anything measured at mount is now stale |

The last cell is the one people skip and the one that hurts. A control that measures itself once —
an animated tab indicator, a sticky offset, a virtualised row height — is measured against the layout
that existed before the data arrived. Render the state where the answer lands late, and look at the
control that moved, not at the content that arrived.

The uneven-length cell is the same argument horizontally: equal fixtures make every card the same
height, and a row of equal cards proves nothing about the row a reader will actually get.

## Integrated scenarios

Avoid Cartesian explosion. Prefer a small scenario set whose entries name every owner state they
cover—for example, a stable authenticated layout plus a loading dashboard page plus a populated
account-menu trigger. `covered-by` is valid only when the referenced scenario visibly proves the
same owner's behavior.

## Loading truth

- Preserve resting width, height, row count and separators.
- Skeleton only unresolved content; keep static labels and known values visible.
- Do not show a resting value and skeleton for the same slot.
- Repeated contracts use their declared resting count.
- Pending actions show vendor-supported loading, block duplicate actions and keep accessible names.
- If independent queries resolve independently, preview partial availability rather than a fake
  all-page loader.

## When the browser refuses to produce the image

The seal requires a screenshot per rendered state, and the in-app Browser pane composites frames only
while it is displayed — which is the user's window state, not something the run controls. A hidden
pane answers `read_page`, `get_page_text` and `javascript_tool` normally and refuses only
`screenshot`. That refusal is not a state that cannot be captured; it is a capture path that is
closed, and HANDOFF-4 requires the other one to be taken before the evidence is called unobtainable.

Capture with headless Chrome instead, one invocation per state:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu `
  --hide-scrollbars --window-size=1280,900 --user-data-dir=<a fresh temp dir per invocation> `
  --screenshot=<absolute path with forward slashes> <state url>
```

The `--screenshot` path must be absolute, or Chrome answers "Access is denied", and it must use
forward slashes, or a Windows path expanded inside a shell loop writes one file named after the
variable. Each invocation needs its own `--user-data-dir` or the loop produces only its first image.

Only when this path also fails is the evidence a finding, recorded with both attempts and carried to
the phase's item list rather than ending the phase.

## Responsive and theme truth

Render desktop/mobile and light/dark only where the target supports them, but never mark them N/A
without source or product evidence. Persistent layouts and overlays usually require both responsive
and focus/keyboard coverage even when a screenshot shows one desktop state.
