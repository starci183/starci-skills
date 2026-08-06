# Why this skill is shaped the way it is

Notes for whoever changes it. `SKILL.md` is the interface; this is the reasoning behind it.

## Why enumeration beats a service list

The obvious shape is a branch per datastore: `pg_dump` for postgres, `--rdb` for redis, `mc mirror`
for minio. It reads well and it is what most backup scripts look like.

It has one failure mode, and the failure is silent. Someone adds a service; the backup script does
not know about it; the backup keeps succeeding. Nothing goes red. The gap is discovered at restore
time, which is the one moment when discovering a gap is useless.

Asking the runtime which volumes exist removes the class entirely. It is not a shorter way to write
the same thing — it is a different guarantee. That is why the skill states it as a rule rather than
a suggestion, and why it says to find the equivalent enumeration for a non-compose runtime rather
than falling back to a hand-written list.

## Why stopping the stack is the default

A hot copy of postgres is the textbook torn-snapshot case: the heap and the WAL are captured at
different instants, and the result refuses to start. The cost of avoiding it on a dev box is a few
seconds.

`--hot` exists because there are stacks where downtime is genuinely unacceptable. It is a flag and
not the default because the person choosing it should be choosing it, and because the risk is
invisible until the restore — so the warning has to name the likely casualty rather than say
"may be inconsistent".

## Why encryption happens on the way in

Writing plaintext into the repo and encrypting afterwards leaves a window where the whole database
sits readable in the working tree. The window is short, which is exactly what makes it convincing —
and `git add -A`, an editor auto-save, or a crash inside it puts the contents somewhere that only
a history rewrite can remove.

Staging in a temp directory outside the repo costs nothing and removes the window. The `finally`
matters as much as the encryption: an error mid-backup must not leave plaintext behind.

## Why a fixed filename, and why the cost warning

Timestamped snapshots accumulate. Each is a multi-megabyte binary blob, and encrypted data does not
delta-compress — two snapshots differing by one row are two entirely different files. A repo that
commits daily snapshots grows by the size of the database daily, forever.

A fixed name bounds that to one blob per stack per commit. It is still a real cost, which is why
the skill requires saying so out loud the first time a project starts committing snapshots, and
offering object storage as the alternative. The point is not to push one answer — it is that the
repo owner should not discover the growth six months later.

## Why the split from restore

Backup is safe and restore is destructive. Keeping them in one skill means the destructive path is
one typo away whenever someone reaches for the safe one. They also get used at different moments by
different people: backup runs before risky work, restore runs during recovery, when nobody is
reading carefully.
