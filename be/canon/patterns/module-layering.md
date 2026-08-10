# module layering

## Definition

A capability is a folder that owns one subject — the AI layer, the databases layer, a feature's
API surface. The rules here are about the SEAMS between capabilities: what an import may name, what
a capability may say about itself, and where a cross-capability dependency is allowed to be wired.

Every one of them exists because the alternatives produce cycles. Not the loud kind the compiler
catches — the quiet kind where a capability reaches its own internals through its public door,
where a barrel drags in a graph nobody asked for, and where a module imports a sibling directly and
the two can no longer be started apart.

The question that settles a case: **could this file be moved to another repository with its
capability, and still make sense?** If it names a barrel, or reaches sideways, or points at itself
through the public alias, it cannot.

What holds this law is [`sources/be/module-layering.mjs`](../../../sources/be/module-layering.mjs).

## Rules

**LAYERING-1 · An import names the file that declares the symbol, never a barrel.**

`@modules/ai/ai-invoke.service`, not `@modules/ai`. A barrel is a file that re-exports a folder, and
importing one pulls in the whole folder's import graph to get one symbol — which is how a unit spec
ends up booting a database driver, and how two capabilities that never reference each other end up
in a cycle through a third.

It also destroys the one thing a reader wants from an import list: which FILE this depends on.

**LAYERING-2 · Inside a capability, imports are relative.**

A file under `modules/ai/` reaching for `@modules/ai/...` is the capability talking to itself
through its own front door. It is a cycle magnet, and it is a lie about the boundary: the alias
exists to say "this comes from elsewhere", so using it for something that does not is exactly the
signal that stops meaning anything.

**LAYERING-3 · A cross-capability dependency is registered at the composition root.**

A `@Module` under the capability trees does not import another capability's module directly.
Something has to know about both, and that something is the application's own root — the one place
whose job IS knowing what the application is made of.

Nesting within a capability stays, and so do aggregators. The rule is about SIDEWAYS edges, not
downward ones.

**LAYERING-4 · The composition root is the only place that knows the whole.**

Which capabilities exist, which are global, what order they start in. Pushing any of that into a
capability makes that capability un-startable alone — and the first thing you want when something
breaks is to start one piece by itself.

**LAYERING-5 · A capability's public surface is the files it means to be imported.**

There is no index re-exporting everything; a caller names the file. That makes the surface visible
in the import list of the callers rather than declared in a barrel nobody reads, and it makes an
accidental dependency show up as a strange-looking import rather than as one more name in a list.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| `@modules/<name>` with no file after it | A barrel drags the whole folder's import graph in to get one symbol, and hides which file is depended on | Name the declaring file |
| `@features/<name>` or `@tests/<name>` as a barrel | Same | Same |
| `@modules/<own capability>/...` from inside that capability | The capability is talking to itself through its public door: a cycle magnet, and the alias stops meaning "elsewhere" | A relative import |
| A capability `@Module` importing another capability's module | Two capabilities that can no longer be started apart, wired somewhere that does not own the question | Register it at the composition root |
| A barrel file that re-exports a folder | It is the thing that makes every rule above unenforceable | Let callers name files |
| Start-order knowledge inside a capability | The capability can no longer be started alone, which is the first thing you want when it breaks | Keep it at the root |

## Examples

### The ordinary case — the import names a file

```ts
import {
    AiInvokeService,
} from "@modules/ai/ai-invoke.service"
```

```ts
// Wrong: to get one service this pulls in everything the ai folder re-exports, and a reader
// cannot tell which file is actually depended on.
import {
    AiInvokeService,
} from "@modules/ai"
```

They differ in one thing: whether the dependency is a file or a folder.

### The self-alias trap

```ts
// inside modules/ai/: the sibling is a relative import
import {
    AiEntitlementService,
} from "./ai-entitlement.service"
```

```ts
// Wrong: the same file, reached through the capability's own public alias. The alias is supposed
// to mean "this comes from somewhere else", and now it does not.
import {
    AiEntitlementService,
} from "@modules/ai/ai-entitlement.service"
```

They differ in one thing: whether the alias still signals a boundary crossing.

### The sideways-wiring trap

```ts
// apps/<app>/src/app.module.ts -- the composition root, whose job IS knowing the whole
@Module({
    imports: [
        AiModule,
        MembershipModule,
    ],
})
export class AppModule {}
```

```ts
// Wrong: inside modules/membership/. Membership and AI can no longer be started apart, and the
// decision was made in a file whose subject is neither of them.
@Module({
    imports: [
        AiModule,
    ],
})
export class MembershipModule {}
```

They differ in one thing: whether either capability can still be started by itself.
