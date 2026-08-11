# page

## Definition

A page is **one screen, composed of blocks**. It answers the questions no single block can — is there
a session at all, which of the screen's whole situations is this — and then arranges blocks into the
reading order that situation calls for.

It owns no request of its own beyond that. Every figure on screen belongs to the block that fetched
it, so the blocks land independently and the page never becomes the file that waits for all of them.

The question that settles it: **does this correspond to a route the reader can arrive at?** If yes,
it is a page. If it is a region of one, it is a block.

## Rules

**PAGE-1 · A page folder holds exactly two files.**

`component.tsx` and `index.tsx`, and nothing else. Anything reusable that appeared there belongs to a
lower tier, and the two-file rule is what makes that visible: a third file is the notification that
something was invented here which should have been named somewhere findable.

**PAGE-2 · It settles the SCREEN-level situation, and only that.**

Whether there is a session, whether the reader may see this at all, which of the screen's whole
states this is. Not whether the quest has loaded — that is the quest's own question, and answering it
here would make every other region wait for it.

**PAGE-3 · Blocks land independently, and that is the trade.**

Each block owns its own request, so they arrive out of step. This is deliberate: one shared flag
between them would make the fastest wait on the slowest, and a screen that appears all-at-once after
three seconds reads slower than one that fills in over one.

**PAGE-4 · It never reaches inside a block.**

No prop tuning a block's internals, no appearance prop, no data threaded through. A page that
rearranges a block's parts has made every future change to that block a page edit.

**PAGE-5 · It says how many pixels only through named nodes.**

The screen's own arrangement — rail then main, heading over body — is contract nodes like anywhere
else. A page is not exempt from that because it happens to be the top.

**PAGE-6 · It may use basic vocabulary leaves directly.**

A heading, a line of copy, a button. What it may not do is arrange two of them by hand; that
relationship is a node with a name.

**PAGE-7 · Reading order is the design, and it is stated.**

Which block comes first is a decision about what the reader came for, not an accident of import
order. Where the order carries a reason, the reason is written beside it — otherwise the next author
reorders it for a layout convenience and quietly changes what the screen is about.

**PAGE-8 · The route file mounts the page and does nothing else.**

No fetching in the route, no arrangement in the route, no contract node in the route. If a route file
is drawing anything, the page it should be mounting does not exist yet.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A third file in the page folder | Something reusable was invented here instead of being named where others can find it | Move it to `block`, `composite` or `branch` |
| Fetching a block's data | The page becomes a data layer, and breaks whenever any payload changes | Let the block fetch its own |
| One `isLoading` for the whole screen | The fastest region waits for the slowest, and the screen appears to hang | Let each block land when it lands |
| Passing appearance or layout props into a block | Every future change to that block is now a page edit | Give the block a semantic variant, or hold it in a different node |
| Writing a class for the screen's own arrangement | The top of the tree is not exempt from the contract table | Name a node for the screen topology |
| Arranging two leaves by hand | That relationship needs a name like any other | Use a composite or a named node |
| Drawing anything in the route file | The route stops being a mount point and starts being a second page | Mount the page; move the drawing into it |
| Reordering blocks for a layout convenience | Reading order says what the screen is about | Change the order deliberately, and write why |

## Examples

### The ordinary case — the page settles one question

```tsx
// page: it answers the one thing no block can — whether there is a session — before composing.
export const DashboardPage = () => {
    const token = useSessionToken()
    const router = useRouter()

    useEffect(() => {
        if (token === undefined) router.replace("/authentication")
    }, [router, token])

    if (token === undefined) return null
    return <_DashboardPage />
}
```

```tsx
// Wrong: the page now fetches for its regions, so every block waits for every other one and the
// screen breaks whenever any payload changes.
export const DashboardPage = () => {
    const quest = useQueryMyDailyQuestSwr()
    const courses = useQueryMyCoursesSwr()
    const kpis = useQueryMyKpisSwr()
    const isLoading = quest.isLoading || courses.isLoading || kpis.isLoading
    return <_DashboardPage isLoading={isLoading} quest={quest.data} courses={courses.data} />
}
```

They differ in one thing: whether the screen's regions can land independently.

### The route-file trap

```tsx
// route: it mounts the page. Nothing else.
const DashboardRoute = () => <DashboardPage />
export default DashboardRoute
```

```tsx
// Wrong: the route is drawing. There is now a second page, in a file that is supposed to be a
// mount point, and nobody will look for arrangement here.
export default function DashboardRoute() {
    return (
        <Tree contract="nav-over-body-page">
            <ShellNav />
            <DashboardPage />
        </Tree>
    )
}
```

They differ in one thing: whether the route file draws.

### Reading order carries a reason

```tsx
// page: the order is the design, and the reason is where the next author will read it.
{/* Read in the order a day is spent: what to do now, how the run is going, what the week is
    aiming at, then what is already under way. */}
<ContinueLearning />
<DailyQuest />
<StreakStrip />
<WeeklyGoals />
```

```tsx
// Wrong: reordered so the two short cards sit side by side. The screen now opens on a statistic
// instead of on the reader's next action, and nothing records that this was a change.
<StreakStrip />
<WeeklyGoals />
<ContinueLearning />
<DailyQuest />
```

They differ in one thing: whether the screen still opens on what the reader came for.
