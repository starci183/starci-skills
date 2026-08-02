# Rules over the whole table

A component matrix answers one question — given this shape of data, which component renders it — and
it only works while the answers stay decidable. Read this when a row has been picked and you want to
know why the table is shaped the way it is, or when proposing a new row. Not needed for an ordinary
lookup.

## The five

1. **Look the table up BEFORE building**, not after building and then auditing. Auditing afterwards
   finds the mismatch at the point where changing it costs a rewrite, and the rewrite is what gets
   deferred. If no row matches, only then consider extending the component set — and that is an
   OWNER decision, not an author's. Draw the proposed entry, show it beside the rows it sits between,
   and let the owner rule on it.

2. **DATA SHAPE decides the component, not the specific content.** A one-sentence paragraph and a
   two-hundred-line article are the same shape and take the same component; a list of one line and a
   list of eight lines are the same shape and take the same one. Choose by the deciding test written
   into the section, not by eye, because two components in a family routinely share a skin — the
   same frame, the same dividers, the same outer label — and a screenshot cannot tell them apart.
   What separates them is a structural fact: whether a body is hidden until a click, whether the
   rows repeat, whether the length can ever be greater than one.

3. **The component's name must match the concept being rendered.** An items array that is always
   length one. A list component holding a single paragraph. A disclosure that never opens. A
   classification chip around a free-running number. A name with "Card" in it and no card in sight.
   Every one of these is wrong at the DATA-SHAPE level, even though the render looks fine and every
   automated check stays green — and that is exactly why the name is worth arguing about, because it
   is the only signal left once the gates are satisfied.

4. **The type is an invitation.** A prop named `title` declared as `ReactNode` invites the caller to
   stuff a markdown renderer into it, and eventually somebody will. A generic content slot on a list
   item invites the loss of every constraint the list was built to hold. Tightening the type is the
   cheapest way to close that door — and tightening honestly requires checking the real cases first:
   if every current caller is pushing an icon into `title`, the answer is a dedicated slot for the
   icon, not leaving the type wide open because three call sites need it.

5. **Every new row carries an anchor** — a date, the case it was read from, and the reviewer's own
   words if there were any. One example is not a rule. Promoting an observation to a general rule
   takes two independent sources; with one, say plainly that it is anchored to that single case, so
   the next reader knows what they are allowed to generalise from.

## Reading a zero correctly

A component with no call sites is not thereby the wrong component. Some rows exist because a family
must be complete: the nested variant that is reached through a prop rather than by name, the rare
selectable form, the placeholder nobody has needed yet. Some cover a region no screen has required
so far.

But a zero also does not license picking that component without re-checking the deciding test of its
section. Zero call sites means zero people have ever discovered that it does not fit — the usual way
a component earns its place is by surviving a case that nearly broke it, and an unused component has
survived nothing.

Keep the counts somewhere they can be recounted rather than in prose. A number written into a
sentence is correct on the day it is written and quietly wrong a fortnight later, and a reader
quoting it is quoting something nobody can reproduce.

## Drifts flagged on purpose, left unfixed

Record the known deviations in the open, with the reason they were left. Two things go wrong when
they are not written down: somebody "clears the debt" without knowing why it was accepted, and
somebody else reads the deviation as the house pattern and copies it.

The recurring shapes are worth naming, because they repeat across every component set:

- One member of a family that reaches straight down to the vendor component while its siblings go
  through the shared wrapper. The render is identical, so nothing reports it, and it becomes the
  file that does not get the next fix.
- Two branches of the SAME component going through two different doors — the loaded branch on a bare
  vendor control, the skeleton branch on the house wrapper. Neither branch is wrong on its own; the
  pair is.
- A component holding a private copy of another component at the top of its own file, with a note to
  switch to the real one later.

Each of these is a deliberate deferral or it is rot, and the only difference between the two is
whether somebody wrote down which.

## Names that are not doors

Some exports exist only so that the layer that owns them can compose itself, and are not entry
points for anyone above. Keep that list beside the table — the parser glue for a markdown renderer,
the internal row of a list, the unconstrained layout primitive that the constrained ones are built
from.

Reaching for one of these from a higher layer is almost always a way of routing around a constraint
rather than a discovery of a better path. If the constrained component genuinely cannot express what
is needed, that is an argument to make about the component, in review, where the answer can become a
new row.
