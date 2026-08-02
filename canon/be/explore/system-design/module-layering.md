# Module layering — capability modules, one arrow, one public entry, ports and adapters

This file decides how the source is cut into modules, which module may import which, and what a
module is allowed to expose. The concrete idiom is Nest's dynamic modules and DI container over a
monorepo; the rules hold for any language with a module system and a composition root.

The industry ground is David Parnas' information-hiding criterion (1972), Eric Evans' bounded context
(*Domain-Driven Design*, 2003), Alistair Cockburn's Ports and Adapters (2005), Robert Martin's Clean
Architecture (2012 essay, 2017 book), Chris Richardson on database-per-service (microservices.io),
and the 12-Factor App (Adam Wiggins, 2011) for the composition root and configuration.

## Cut by capability, not by technical layer

**A top-level folder is a business capability with its own model.** `controllers/`, `services/`,
`dtos/` and `entities/` as top-level folders is the smell Parnas named: the cut follows the
implementation technique rather than the reason to change, so a single feature change touches four
folders and every folder is touched by every feature.

The test is the diff. **Adding a field to one capability should read as one folder in the change
set.** If it reads as one file in each of four layer folders, the layers are the modules and the
capabilities are not.

Two tiers survive this rule and it is worth naming them, because the second is often mistaken for a
layer module:

- **Capability modules** — a business capability, its model, its rules, its persistence.
- **Technical capability modules** — cache, object storage, mail, search, message bus. These are
  legitimate and they are not layers, because each is a *thing the system can do* with its own
  vocabulary. The line that keeps them honest: **a technical module never imports a business
  module.** The moment the cache module knows what an enrolment is, it has stopped being a
  capability and become a layer with a misleading name.

Inside a capability, layer folders are fine. The rule is about the top of the tree, where the cut
decides what a change costs.

## One arrow, and it points inward

**Source dependencies point one way: delivery, then use case, then infrastructure — never back.**
Cockburn and Martin state it from the dependency side, Evans from the model side, and they agree:
the layer holding the rules must not name the framework that delivers requests to it.

The strict test is a compile: **the use-case layer must build with no import of the web framework,
the ORM, or the broker client.** That is the version worth aiming at, and the version most houses do
not fully take, because it costs a second set of persistence types. If you take the pragmatic trade —
one model, carrying ORM decorators, used by the domain — then **say exactly where the line is**,
because an unstated compromise erodes:

- The business layer may name persistence types and mapping decorators.
- The business layer must never import the HTTP or graph layer, the request object, the framework's
  exception classes, or the broker client. A rule expressed as an HTTP status is a rule that cannot
  be reused by a worker or a scheduled job, and every one of those exists eventually.

This is machine-checkable and should be a gate rather than a review habit: ESLint's
`no-restricted-imports` with path zones, `eslint-plugin-import`'s `no-restricted-paths`, or
`dependency-cruiser` with a forbidden rule per arrow. A one-line CI failure is worth more than the
paragraph above.

**Cross-capability reads follow the same arrow.** One module owns its tables; another module reading
them directly has taken a dependency on a schema it cannot see change (Richardson's
database-per-service, applied inside one process). Reach a neighbour through its public service or,
better, through an event. The symptom to watch for is one capability importing another's entity class
purely to write a join.

## One public entry per module

**A module exposes exactly one entry point, and everything else is internal.** In practice this is a
barrel that exports the module class, the tokens and interfaces callers bind against, and the types
that appear in those signatures. Not every file.

The reason is refactoring cost. Without an entry point, every file in the module is public by
accident, and a rename that should have been local becomes a change across the repository. With one,
the module's internals can be rearranged freely as long as the barrel keeps its promises — which is
the whole point of information hiding, expressed as a folder.

Deep imports into another module's internals are therefore banned. Machine-checkable:
`import/no-internal-modules` with an allow-list, `no-restricted-imports` patterns such as
`@modules/*/!(index)`, or the `exports` field in a package manifest for a genuine workspace package,
which enforces it at resolution time rather than at lint time.

**A barrel is not free.** It creates a single node every importer depends on, which is how import
cycles appear between two modules that each import the other's index. If a cycle appears, the fix is
almost never a deeper import; it is that the two modules share a concept that belongs to a third one,
or to neither.

## Ports and adapters

**The layer that owns the rules declares the interface; the edge supplies the implementation.** The
interface is named for what the domain needs, not for the vendor that happens to provide it — an
object store, not an S3 client — because a port named after its vendor has already leaked the vendor
into every call site.

```ts
// modules/storage/object-store.port.ts — the port. No SDK import, no framework import.
export const OBJECT_STORE = Symbol("OBJECT_STORE")

export interface ObjectStore {
    put(key: string, body: Buffer, contentType: string): Promise<void>
    signedUrl(key: string, ttlSeconds: number): Promise<string>
}

// modules/bussiness/lesson/publish-lesson.service.ts — the use case depends on the interface.
// Nothing here can name a bucket, a region, or a vendor error type.
@Injectable()
export class PublishLessonService {
    constructor(
        @Inject(OBJECT_STORE) private readonly objectStore: ObjectStore,
    ) {}

    async publish(lesson: LessonEntity, rendered: Buffer): Promise<string> {
        const key = `lessons/${lesson.id}/${lesson.locale}.html`
        await this.objectStore.put(key, rendered, "text/html")
        return this.objectStore.signedUrl(key, PUBLISH_URL_TTL_SECONDS)
    }
}

// modules/storage/adapters/s3-object-store.ts — the ONLY file that imports the SDK.
@Injectable()
export class S3ObjectStore implements ObjectStore { … }

// modules/storage/storage.module.ts — the composition root of this module: the one place
// where the port and the adapter are allowed to meet.
@Module({
    providers: [{ provide: OBJECT_STORE, useClass: S3ObjectStore }],
    exports: [OBJECT_STORE],
})
export class StorageModule {}
```

Two payoffs, and they are why the ceremony is worth it. **Tests**: the use case is exercised with an
in-memory adapter, so nothing in the rule layer needs a network to be verified. **Churn**: the second
provider — a second payment gateway, a second mail sender, a local model beside a hosted one — is the
moment you discover whether you had a port or a pile of vendor calls.

**When not to build a port.** A single implementation that will never have a second, wrapping
something already trivially fakeable, is ceremony. The honest threshold: **introduce the port when a
second implementation appears, or when the first one cannot be exercised in-process, whichever comes
first.** That is judgement and no gate can decide it; what a gate *can* decide is that the vendor SDK
is imported in exactly one folder, which is the property you actually care about.

## The composition root is one place, and it is the proof a module exists

**Modules declare what they need; one place assembles them.** A module that reaches into the
environment, constructs its own dependencies, or reads a config file has made itself impossible to
run twice with different settings — and testing, staging and a second tenant are all "twice with
different settings".

- **Configuration is read in exactly one module** and passed as values (12-Factor III). Everything
  else receives a typed object. That single module is also the only place a default lives, which is
  what makes "what is this setting in production" answerable by reading one file.
- **A module registered nowhere runs nowhere.** The folder existing proves nothing; the manifest that
  assembles the application is the list of what is real. When auditing a service, read the
  composition root first — it is the only artefact that cannot lie about what ships.
- **The composition root will be large and that is correct.** It is a list, not logic. The failure to
  watch for is logic creeping into it — conditionals choosing providers by environment are a sign a
  port is missing, and duplicate registrations of the same module with different options are how two
  configurations of one thing end up live simultaneously with the last one silently winning.

## Related

[`api-design.md`](api-design.md) (the delivery layer this arrow starts at) ·
[`data-access.md`](data-access.md) (the infrastructure layer it ends at, and why one module owns a
table).
