# Source fit output

Return one JSON value that validates against `output.schema.json`.

Every required owner receives exactly one verdict:

- `reuse`: instantiate the exact existing effective contract without structural change;
- `extend`: use only an axis opened by both Grammar and the resolved effective contract, with a declared source delta;
- `create-block-or-above`: create an application Product Block, Layout or Page while reusing every required lower-tier owner;
- `grammar-gap`: stop local lower-tier reconstruction and create a durable request for the missing generic owner, export, state map, complex-case row or extension axis.

Application source normally authors from Product Block upward. Leaves, branches and composites may only be existing package exports or declared extensions. A missing lower-tier reusable owner is never permission to recreate it locally.

The output summarizes which facts are added for routing: `create-required` when at least one block-or-above owner is new, and `grammar-gap` when package authority is incomplete. It carries request obligations forward without writing requests itself.
