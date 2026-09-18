# Visual review

The direction shows the many-tasks state at desktop-1280: a create-task field and primary action sit above several plain list rows, with both completed and incomplete native checkboxes, task titles, and per-row delete actions inside one compact surface.

Real `@starci/grammar/common` anatomy depicted: `Heading`, `SurfaceCard`, `Input`, and `Button`; the collection rows remain application-owned native `ul`/`li` and checkbox markup, not `SurfaceListCard` or `StaticStateRow`. The representative many-tasks direction derives empty and one-task by changing row count, and refused by retaining only the `SurfaceCard` with an assertive-live `Text` while hiding the form and rows.

This is a visual direction generated from the retained prompt. It is not a render or screenshot of the running product, and it does not prove exact Grammar rendering, component props, native markup, semantic DOM, accessibility behavior, interaction behavior, or API behavior.
