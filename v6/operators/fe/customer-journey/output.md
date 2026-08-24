# Customer journey output

The operator returns exactly two or three materially different end-to-end flow directions at `flow.review / pending`.

Every direction defines:

- a stable id and one-sentence thesis;
- actor goal, entry condition and terminal success;
- the ordered page intents from start to finish;
- user commitment, system response and recovery at each step;
- the trade-off that distinguishes it from the other directions;
- whether one global journey-progress owner is required.

A multi-page linear journey has one global progress owner. Each page later references that owner. Tabs are not journey steps; they are reserved for exclusive panels within one page.

The batch is cache-only and bound by a stable hash. It asks for `OK FLOW <id>`. This is creative checkpoint one of exactly two. It does not write source, create product requests, choose components or generate layouts.
