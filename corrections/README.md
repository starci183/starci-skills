# corrections — the feedback ledger

A correction a person gives a skill once should never be needed again. This folder is where each one
waits between the moment it is written and the moment it is folded into the skill it was about, so the
miss is fixed in the skill rather than remembered by a person.

It used to be a single file that every hand appended to. That is one sheet many people reach for at
once — and many of the hands here are background sessions running in parallel, each finishing a task
and each writing down the correction it earned. Two appends to one file race, and one of them is lost
under the other with no trace it was ever written. So the ledger is a folder, not a file. **One
correction, one file.** Separate files never collide the way a shared one does; a dozen sessions can
each drop a note in the same second and every note survives.

## The two folders

```
corrections/pending/   corrections written, not yet folded in
corrections/applied/   corrections folded in, kept as the trail
```

`corrections/pending/` holds the open work — a correction recorded but not yet taught to the
skill. `corrections/applied/` holds the same notes after they have been folded in, kept so a
later reader can see why a skill reads the way it does. The applied folder is a record, not a bin. It is
never emptied.

## One correction file

A file is named for the day it was written, the skill it targets, and a short slug that says what it is
about, so a folder listing reads as a list of misses without opening a single one:

```
<date>-<skill-name>-<short-slug>.md
```

The body states the miss, the reason behind it, and the concrete change — and carries its own status:

```
# <short title>
status: open

What was corrected: the miss, in a sentence or two — a rejected option, a rule restated, "not like that".
Why: the reason it was wrong, so the fix survives a case its author never saw.
How to apply: the concrete change to the skill — a rule for skills/hooks/, a step to fix, a reference to write.
```

Write the reason, not the story. *How to apply* is the load-bearing line: it names where the fix lands,
because that is what the upgrade skills act on. A note with no target skill and no concrete change is not
a correction — it is a feeling, and it will sit open forever.

## The lifecycle

A file is born in `corrections/pending/` with `status: open`. It stays there until the suite is
taught the lesson. Then it is folded into the skill and moved — the same file, unchanged in body — into
`corrections/applied/`. Open means *not yet learned*; applied means *learned, and kept as the
reason*.

Two skills work the folder, and only these two:

- `skills/starci-upgrade-plan` reads `corrections/pending/` and decides, for each open note, where
  the fix belongs and what the smallest edit is that keeps the miss from returning.
- `skills/starci-upgrade-apply` makes that edit in the skill, verifies it with the skill's own test, and
  then moves the file to `corrections/applied/`. It edits the skill, not the note — the note is
  the input, the changed skill is the output.

A person writes into `pending/`. The upgrade skills read it and move it to `applied/`. Nothing else
writes here.

## Rules

- One entry per correction. If the same note lands twice, the skill was never upgraded — that is a bug in
  the loop, not a second file.
- A correction that applies to every FE skill belongs in `skills/hooks/`, and the *How to apply* line
  says so. It is not filed against one skill when it is really about all of them.
- Do not delete applied entries. They are the record of how the suite learned to read the way it does.
