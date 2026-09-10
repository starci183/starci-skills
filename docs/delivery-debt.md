# Deliver first; defer form-only cleanup

Classify impact, not the error label. Defer a cosmetic defect only when it changes neither accepted SRS/SDS meaning, permissions, scope, source/build identity nor the ability to inspect real results. Examples: prose typos, redundant headings, display formatting, or a missing convenience link when the correct artifact remains accessible. Record it once and continue the authorized workflow; do not demand another Plan or approval for cleanup alone.

Use the affected module's `business/debt.md` inside backend-owned `.starciwork`. Shared defects have one shared business owner; consumers link that entry. Create the file only for actual findings. This Markdown ledger is not SRS, a Work node, approval or completion proof. Do not declare it as a semantic input solely for tracking cosmetic cleanup.

Each entry records a stable ID, issue, affected workflow/artifact, impact, why deferral is safe, owner, status and closure check. Link actual code/test/UAT proof when available; never claim future proof exists. Use open, ready-after-uat or resolved. Preserve the observation and add the resolution.

Continue code and the full UAT route. Once actual implementation, backend checks and applicable browser UAT are complete, resolve form-only debt in a bounded cleanup pass. Open cosmetic debt may coexist with a verified workflow result when explicitly reported. Product done still requires all substantive criteria. Alpha-to-beta completion additionally requires promised cleanup and runtime regression checks.

Never classify incorrect business behavior, architecture contradictions, security/tenant isolation failures, unsafe data/recovery, unauthorized effects, unknown source/build identity, mismatched proof hashes, missing executed E2E/UAT or required media, or failed behavioral assertions as cosmetic. A prose typo is cosmetic; a broken sole source identity is not until independently reconciled.

For a validator rejecting equivalent formatting, preserve actual proof and correct the representation locally within existing authority; record the runtime defect. Do not disable validation, edit sealed evidence, forge a passing run or silently bypass a machine gate. If the runtime cannot represent a truthful result, report the concrete blocker once and use authorized runtime repair, not repeated product preparation Plans or retired registry structures.
