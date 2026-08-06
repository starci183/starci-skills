# Why this skill is shaped the way it is

Notes for whoever changes it. `SKILL.md` is the interface; this is the reasoning behind it.

## Why this is a separate skill from backup

They look like halves of one thing, and one of them destroys data. Whenever the safe operation and
the destructive one share an entry point, the destructive one is one flag away at the moment
somebody is moving fast.

They are also used in different states of mind. Backup runs before deliberate work, calmly. Restore
runs after something has already gone wrong, when nobody is reading output carefully. A skill used
in that state has to front-load the warnings rather than trail them.

## Why "replace" rather than "unpack over"

Unpacking an archive onto an existing volume keeps every file the archive does not mention. The
result is a mixture of two points in time, and it is the worst outcome available — not because it
is the most broken, but because it looks like it worked. A clean failure gets fixed; a plausible
mixture ships.

Clearing first makes the volume hold exactly what the snapshot holds. The dotfile note is there
because it is the specific way this goes wrong: `rm -rf /to/*` misses `.pgdata`-style hidden state,
and what is left is the plausible mixture again.

## Why the verification step is not optional

"Restore complete" is a statement about a script finishing, not about data existing. The gap between
those two is exactly where an untested backup lives.

Querying one datastore for something the snapshot is known to contain converts the claim into
evidence. It costs one command. The skill asks for it in the report because a result nobody checked
is indistinguishable from a result that was checked and passed — and only one of them is worth
anything the next time the data is gone.

## Why the two failure diagnoses are named

When `sops` fails to decrypt, the message it gives is not the useful one. In practice it is nearly
always either the wrong identity or a corrupted archive, and the second has a specific cause worth
naming: git rewriting line endings inside a binary file on checkout. That is why the skill points at
`*.enc -text` rather than leaving it as "corrupted in transit" — the fix is one line in
`.gitattributes`, and without it a snapshot that committed cleanly comes back unusable on the next
machine, which is the machine that needed it.

## Why testing a backup is filed here

It is the same operation pointed at a throwaway target, and giving it its own name would create a
third skill that drifts from this one. Naming it inside the restore skill also puts the idea in
front of the person who has just restored something — the moment they are most likely to accept that
an untested backup is not a backup.
