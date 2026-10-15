Owner: knowledge/hfs/rules.yaml

# Front-end source authoring

## R91 source form

`FE_SOURCE_FORM` keeps public source readable and predictable in lite and full. Export documented arrow functions with the component folder's name. Use English identifiers, comments, strings and test titles; put translated product copy in locale catalogs. Source authoring contains no emoji. Event handlers use `onX`, and a const adds a value or transformation rather than another name for an existing identifier.

Place component files in their declared tiers, keep source tier markers consistent with their folders, and export a component family as separate members. Surface folders contain their entry, presentational half and optional class-name file. Helpers belong in their declared module or hook owners. The route tree contains framework slots whose default components use the slot's fixed name. With multiple apps and a declared shared UI package, feature-free vocabulary belongs in the package and feature tiers belong in the app. There is no shell tier.

`FE_SOURCE_LAYOUT_INVALID` identifies a production source file outside its tier: routes, features, components, hooks or modules. Only the framework's declared root files may sit directly at the source root. A custom hook is grouped below a hook domain; moving an arbitrary `src/config.ts` into its owning module corrects the layout.
