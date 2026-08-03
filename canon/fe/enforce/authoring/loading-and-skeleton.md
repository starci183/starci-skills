# Loading and skeleton — how to WRITE an async state — STRICT

> The code convention for EVERY region rendered from data (SWR or a query): the block takes a single
> `isSkeleton` prop and threads it down to its leaves, so the shimmer stays CO-LOCATED and mirrors the
> loaded shape. Every example below is quoted from real code on branch `mtp`. This is code style, not
> a design rule.

## 1. A data-owning block takes `isSkeleton` and threads it to its leaves — the shimmer is co-located

Every region rendered from data takes a single **`isSkeleton?: boolean`** prop and, when set, renders
its OWN normal tree with `isSkeleton` threaded down to each leaf it draws. Every atom, frame, and
composite exposes its own `isSkeleton` and switches to a shimmer sized to the exact box its value will
occupy (atom `ATOM-4`, composite `COMPOSITE-10`). Because the skeleton is the SAME tree as the loaded
state, it mirrors the loaded shape automatically — nothing collapses, nothing jumps, and it cannot
drift. Keep the shimmer co-located: a centrally-gathered, hand-built skeleton is a second copy of the
layout that drifts the day someone edits one and not the other.

`error` is NOT a per-block prop — there is no hand-rolled `if (error) … if (isLoading) …` switch inside
the presentational block. `isEmpty` is derived from the resolved data (§2). The connected half computes
`isSkeleton` from the first-load formula (§2) and passes it, with the resolved data and `isEmpty`, to
the presentational `_Name`.

```tsx
// ConsultantCard (condensed) — the block renders ONE tree; isSkeleton flows straight down to every leaf.
const ConsultantCard = ({ consultant, onOpen, isSkeleton = false }: ConsultantCardProps) => (
    <SurfaceCard isDisabled={isSkeleton} onPress={() => onOpen(consultant.id)}
        body={() => (
            <StackV gap={4} isSkeleton={isSkeleton} items={[
                () => <Image src={consultant.avatarUrl} ratio="square" isSkeleton={isSkeleton} />,
                () => <Typography size="sm" weight="medium" text={consultant.fullName} isSkeleton={isSkeleton} />,
            ]} />
        )}
    />
)
```

```tsx
// Wrong: building a branch chain inside the feature — wrong order, missing branches,
// and a separate skeleton tree that drifts from the loaded one.
if (isLoading) return <Spinner />
if (!data) return null
return <SectionCard>…</SectionCard>
```

### `AsyncContent` — the LEGACY stand-alone async region (being phased out)

A minority of blocks still wrap a self-contained async region in `AsyncContent` (from
`src/components/blocks/async/AsyncContent`) — the composite that holds the priority order
**error → loading → empty → content** and renders a hand-built `skeleton` mirror. This is the OLDER
pattern; it is not the default and is being phased out in favour of the co-located `isSkeleton` above.
Reach for it only for a region that has no leaf tree of its own to shimmer. When you do, pass
`skeleton` (required), and as needed `isEmpty` with `emptyContent`, and `error` with `errorContent` —
each pair travels together (omitting `errorContent` lets an error fall through into the loading branch
and be swallowed).

```tsx
// src/components/features/dashboard/WhoToFollow/index.tsx — LEGACY AsyncContent path
<AsyncContent
    isLoading={isLoading && !data}
    skeleton={<WhoToFollowSkeleton className={className} />}
    isEmpty={!data || data.length === 0}
>
    <SectionCard …>{/* content */}</SectionCard>
</AsyncContent>
```

## 2. The skeleton flag is a FORMULA meaning "first load, nothing in hand" — not a bare `swr.isLoading`

The connected half computes the value it passes as `isSkeleton` (or, on the legacy `AsyncContent` path,
as `isLoading`) from this same formula. Show the skeleton only on the FIRST load, when there is nothing
to show yet. Passing a bare `swr.isLoading` makes a background SWR revalidation flash the skeleton over
content the user is reading.

The dominant idiom is `isLoading && <nothing yet>` — either `&& !data` or `&& items.length === 0`:

```tsx
// src/components/features/notifications/NotificationCenter/index.tsx
isLoading={isLoading && !data}

// src/components/features/profile/AiUsage/AiUsageHistory/index.tsx
isLoading={isLoading && items.length === 0}

// src/components/features/profile/Settings/MySubmissions/index.tsx — settled means data OR error
isLoading={!swr.data && !swr.error}
```

```tsx
// Wrong in general: a bare isLoading flashes the skeleton over content on every background
// revalidation. It is acceptable only for a one-shot query that never revalidates.
isLoading={isLoading}
```

`isEmpty` is computed AFTER loading, from the resolved array: `isEmpty={items.length === 0}` or
`isEmpty={!data || data.length === 0}`. Do not fold the empty condition into `isLoading`.

## 3. The skeleton MIRRORS the loaded shape — nothing collapses, nothing jumps

Under the co-located `isSkeleton` (§1) this is automatic — the skeleton IS the loaded tree with the
shimmer switched on. Sections 3–6 detail how to build a stand-alone skeleton by hand for the LEGACY
`AsyncContent` path; the mirror principle is the same either way.

The skeleton is the SAME layout tree as the real content: keep the structural nodes — wrapper,
`SectionCard`, separators, gaps, spacing — and replace only the CONTENT nodes with
`Skeleton.<Component>`. The goal is that the box neither shrinks nor jumps when the data arrives.

```tsx
// src/components/features/dashboard/WhoToFollow/WhoToFollowSkeleton/index.tsx
// the same SectionCard (icon + title) wrapping N rows of [avatar · two text lines · follow button],
// at the same spacing
<SectionCard icon={…} title={t("dashboard.whoToFollow.title")} className={className}>
    <div className="flex flex-col gap-2">
        {Array.from({ length: SKELETON_ROW_COUNT }).map((_row, index) => (
            <div key={index} className="flex items-center gap-3 px-2 py-1">
                <Skeleton className="size-6 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-0">
                    <Skeleton.Typography type="body-sm" width="1/2" />
                    <Skeleton.Typography type="body-xs" width="1/3" />
                </div>
                <Skeleton className="h-8 w-20 shrink-0 rounded-medium" />
            </div>
        ))}
    </div>
</SectionCard>
```

```tsx
// Wrong: a spinner, or one generic bar, that does not match the shape — the box jumps on resolve.
skeleton={<Spinner />}
skeleton={<Skeleton className="h-40 w-full" />}   // one solid block standing in for a list of rows
```

## 4. Pick the RIGHT piece: `Skeleton.<Component>` to match a real node, bare `Skeleton` for free-form

Match the piece to whatever the real node is: `Skeleton.Typography type=…` (matches the TEXT TIER so
the height matches the glyph and nothing shifts), `Skeleton.Input`, `Skeleton.Avatar size=…`,
`Skeleton.ListRow`, `Skeleton.Table rows cols`, `Skeleton.Accordion items`, `Skeleton.Menu items` —
the full compound lives in `src/components/blocks/skeleton/Skeleton`.

Use a bare `<Skeleton className="…" />` only when the node matches no component, sizing it yourself
through `className` (height, width, radius).

```tsx
// src/components/features/navbar/Navbar/AccountMenuDropdown/index.tsx — the piece matches the node
skeleton={<Skeleton.UserCell />}
skeleton={<Skeleton.Menu items={4} />}

// bare, for a free-form block such as a button or a round avatar of a custom size
<Skeleton className="h-8 w-20 shrink-0 rounded-medium" />
```

```tsx
// Wrong: scattering bare Skeletons where a ready-made piece exists — the height and width drift and
// have to be eyeballed. When the real node is <Typography type="body-sm">, use Skeleton.Typography.
<Skeleton className="h-5 w-40" />
```

## 5. A large skeleton gets its own co-located `<X>Skeleton` folder; a small one goes inline

A skeleton with many nodes, or one mirroring a whole card, becomes its own component in
**a folder `<X>Skeleton/index.tsx`** beside the component — named export, `WithClassNames`, and
JSDoc saying plainly that it mirrors the loaded shape so nothing jumps. This is the dominant idiom:
`WhoToFollowSkeleton`, `CommunityFeedSkeleton`, `WeeklyChallengeCardSkeleton`,
`ChallengeViewSkeleton`.

A one- or two-piece skeleton is passed INLINE into `skeleton={…}` — no folder for it.

```tsx
// large → its own folder, passed by name
skeleton={<WhoToFollowSkeleton className={className} />}         // WhoToFollow/WhoToFollowSkeleton/
skeleton={<CommunityFeedSkeleton />}                             // CommunityFeed/CommunityFeedSkeleton/

// small → inline
skeleton={<Skeleton.UserCell />}
```

Two ways to get the split wrong: creating a `<X>Skeleton` folder that wraps a single
`<Skeleton.UserCell />`, and inlining sixty lines of skeleton JSX into `skeleton={( … )}` of a large
feature, which bloats its `index.tsx`.

## 6. Empty and error states are configured by PROPS, not by nodes

`emptyContent` and `errorContent` take PROPS — `{ title, description?, onRetry?, retryLabel? }` —
and `AsyncContent` builds the standard `EmptyContent` or `ErrorContent` itself: icon, title, an
optional retry button, centred. The text always arrives already translated from the caller
(`t(...)`), never as a hard-coded string.

```tsx
// .storybook/stories/composites/async/AsyncContent/AsyncContent.stories.tsx
emptyContent={{ title: "No submissions yet", description: "Complete a challenge to see it here." }}
errorContent={{ title: "Couldn't load the list", onRetry: () => {}, retryLabel: "Try again" }}
```

```tsx
// Wrong: hand-written empty or error JSX — it drifts from the standard look and repeats everywhere.
isEmpty ? <div className="text-center">Trống</div> : …
```
