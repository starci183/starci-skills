---
name: <kebab-name>
tier: foundations | atom | frame | composite
admitted: YYYY-MM-DD
---

# <Name>

## Role

One sentence. What it exists to do — not what it looks like.

## API

| Prop | Type | Default | Required |
|---|---|---|:---:|
| `value` | `string` | | yes |
| `isSkeleton` | `boolean` | `false` | no |

## Built from

*(frames and composites only)* Direct children, **one level deep**. A child that is itself
composed is listed by name, not expanded — the reader follows the link if they need to go
deeper.

| Child | Tier |
|---|---|
| `Typography` | atom |

Atoms and foundations write: `nothing - this is a leaf`.

## States

Every row must be filled. An omitted state is written as `-` with a reason, never left blank.

| State | Renders |
|---|---|
| empty | |
| loading | |
| error | |
| content | |
| pending | |

| Omitted | Why |
|---|---|
| error | the atom does not know the data |

## Skeleton

Which shape (0-6, see the `skeleton` axis) and what layout it mirrors. **No skeleton means not
admitted.** The frame stays real — only the content nodes turn to bars.

## Tokens

Tokens only. A raw value here is an error, not a choice.

| Axis | Value |
|---|---|
| color | |
| text | |
| seam | |
| inset | |
| surface | |

## Forbidden

What must not be improvised at the call site. Each line is a rule a reviewer can check.

- 

## Verdict

Swept on YYYY-MM-DD. One line per axis, all fifteen. `NOT COVERED` is a valid verdict and must
be escalated, never left blank.

| Axis | Verdict |
|---|---|
| reading-flow | |
| prominence | |
| async | |
| frame | |
| naming | |
| seam | |
| inset | |
| surface | |
| text | |
| icon | |
| color | |
| button | |
| press | |
| markdown | |
| skeleton | |
