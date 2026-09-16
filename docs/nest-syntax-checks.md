# Nest syntax checks

The runtime-owned `checks/code-patterns/nest.mjs` module implements three adopted mechanical code rules. The code-pattern runner supplies the exact applicable relative files and rule IDs; the module uses TypeScript installed in that target repository and returns `starci/code-pattern-script@1`. It neither modifies source nor runs application code.

| Rule | Executable obligation | Deliberate boundary |
| --- | --- | --- |
| `NEST_MEMBER_DOCUMENTATION` | Nonempty docblocks on declared class/interface/type fields, methods and accessors; named `@template`/`@typeParam` tags for generic parameters | Parameter properties count as declared fields. Object-literal entries are not declarations of a reusable contract. A doc inside a decorator argument cannot document the member. Why the comment is useful remains semantic review |
| `NEST_COMMENT_FORM` | Prose line comments stand above code and start with a lowercase first ASCII letter; reasoning blocks in function bodies start with an uppercase first ASCII letter | Parser token boundaries exclude string, template and regex contents. Recognized triple-slash compiler references and `vn-ok:` locale annotations are metadata; this does not waive their other required checks. Accuracy, paragraph meaning and corrected history remain agent review |
| `NEST_IMPORT_FORMAT` | Named braced imports put braces on separate lines, one complete binding on each inner line and a trailing comma for nonempty bindings | Default-only, namespace and side-effect imports have no named brace list. Whether an import is type-only is handled by the separate selected ESLint rule, not guessed by this layout checker |

The module supports `.ts` source, excluding `.d.ts`. Its caller applies the profile's production/test scope. Invalid syntax, unknown rules, missing files, duplicate paths, redirected source parents and missing target TypeScript return errors and no complete rule coverage. The parent runner binds file/tool/config identities and checks exact result coverage. A clean module result establishes only these requested syntax obligations, not all Nest code conformance or behavioral correctness.

The current forms specialize `BE-COMMENT-3/5/6` and `BE-IMPORTS-2`. They clarify the historical examples into executable conditions without turning comment meaning into a punctuation claim. Required code coverage elsewhere in the manifest remains independent; this module cannot fill unrelated checker gaps.
