/**
 * eslint-plugin-starci-be — machine rules for the backend authoring canon
 * (`.claude/canon/be/enforce/authoring/*.md`).
 *
 * Mirrors `starci-academy` (frontend)'s `plugins/eslint/index.mjs`: each rule here "kills" one
 * pattern the authoring canon states in prose, so it is caught at lint-time / pre-commit instead
 * of being re-discovered by review every time. "Canon states it once, lint holds it forever."
 *
 * Every rule is a heuristic over the AST, not a type-checker — some are necessarily approximate
 * (see the comment above each rule for what it does and does not catch).
 */

import path from "node:path"
import fs from "node:fs"

// Capability roots used by the repository-only module-boundary rule.
const MODULES_META_ROOTS = new Set(["lib", "platform", "integrations"])
// ── 3. no-nest-logger ────────────────────────────────────────────────────────────────────────
// observability.md: logs are structured events through `WinstonService`; Nest's own `Logger`
// bypasses the correlation id / transport config it wires up. Reports both the import specifier
// and any `new Logger(...)` construction (in case it was imported under an alias).
const noNestLogger = {
    meta: {
        type: "problem",
        docs: { description: "Ban Nest's built-in `Logger` — only `WinstonService` logs. [[observability]]" },
        schema: [],
        messages: {
            import: "Do not import `Logger` from `@nestjs/common` — inject `WinstonService` instead (observability).",
            construct: "`new Logger(...)` — use the injected `WinstonService`, not Nest's built-in logger (observability).",
        },
    },
    create(context) {
        return {
            ImportDeclaration(node) {
                if (node.source.value !== "@nestjs/common") return
                for (const spec of node.specifiers) {
                    if (spec.type === "ImportSpecifier" && spec.imported.name === "Logger") {
                        context.report({ node: spec, messageId: "import" })
                    }
                }
            },
            NewExpression(node) {
                if (node.callee.type === "Identifier" && node.callee.name === "Logger") {
                    context.report({ node, messageId: "construct" })
                }
            },
        }
    },
}

// ── 9. no-vietnamese ─────────────────────────────────────────────────────────────────────────
// comments.md: "Comments and JSDoc are written in English." The same letter class + the same
// `vn-ok:` escape hatch as the front-end gate (.claude/scripts/gates/check-no-vietnamese.mjs),
// so one repo does not police Vietnamese two different ways. Precise Vietnamese letters only —
// never matches ñ / ç / ü / é-as-French, so a European loanword is not a false positive.
const VIETNAMESE_LETTER = /[À-ÃÈ-ÊÌÍÒ-ÕÙÚÝà-ãè-êìíò-õùúýĂăĐđĨĩŨũƠơƯưẠ-ỿ]/
/** Sanctioned: the Vietnamese language's own name, e.g. in a locale label. */
const VIETNAMESE_ENDONYM = /Tiếng Việt/
/** Sanctioned: FUNCTIONAL Vietnamese the code matches or emits, with the reason stated inline. */
const VIETNAMESE_OK_PRAGMA = /\bvn-ok:/
/**
 * The one place Vietnamese is content rather than commentary: a locale dictionary. A file
 * under `messages/`, `locales/`/`locale/`, `lang/`, or named `*.lang.ts` IS the `vi` locale —
 * policing it for Vietnamese would be policing it for existing. Code that lives next to a
 * dictionary (i18n routing, loaders) is not a dictionary and is still checked, and specs
 * never get this exemption: tests are written in English, full stop.
 */
const VIETNAMESE_LANG_FILE = /(?:^|[\\/])(?:messages|locales?|lang)[\\/]|\.lang\.[cm]?[tj]sx?$/i

const noVietnamese = {
    meta: {
        type: "problem",
        docs: {
            description: "Comments, JSDoc and string literals are written in English. [[comments intro]]",
        },
        schema: [],
        messages: {
            vietnamese: "Vietnamese text — comments, JSDoc and literals are written in English (comments.md). If this Vietnamese is FUNCTIONAL (a literal the code matches on or emits at runtime), keep it and state why with a `vn-ok: <reason>` comment on the same line.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode || context.getSourceCode()

        // Locale dictionaries hold the `vi` locale by definition — skip them entirely.
        const filename = context.filename ?? context.getFilename()
        if (VIETNAMESE_LANG_FILE.test(filename)) return {}

        // The bar is a stranger reading this repo: an engineer who does not speak Vietnamese
        // must be able to read every comment, JSDoc and literal in `src/` and `apps/`. So the
        // check is deliberately unconditional — no carve-out for a term glossed in quotes or
        // parentheses, because a reader who cannot read the gloss gains nothing from it.
        // `.volume/` is the product's CONTENT mount (the `vi` locale itself) and is not part
        // of the linted source tree at all.
        //
        // The one release valve is canon's own: FUNCTIONAL Vietnamese — a literal the code
        // matches on or emits at runtime, where translating it changes behaviour — stays, with
        // `vn-ok: <reason>` on the line so the reason is on the record.
        const isSanctioned = (line) => {
            const raw = sourceCode.lines[line - 1] ?? ""
            return VIETNAMESE_OK_PRAGMA.test(raw) || VIETNAMESE_ENDONYM.test(raw)
        }

        // Report once per node, at the FIRST offending line, so a long JSDoc block yields one
        // actionable location rather than one report per line.
        function check(node, text, startLine) {
            const lines = String(text).split("\n")
            for (let offset = 0; offset < lines.length; offset += 1) {
                if (!VIETNAMESE_LETTER.test(lines[offset])) continue
                const line = startLine + offset
                if (isSanctioned(line)) continue
                context.report({
                    node,
                    loc: {
                        line,
                        column: 0,
                    },
                    messageId: "vietnamese",
                })
                return
            }
        }

        return {
            Program() {
                for (const comment of sourceCode.getAllComments()) {
                    check(comment,
                        comment.value,
                        comment.loc.start.line)
                }
            },
            Literal(node) {
                if (typeof node.value === "string") {
                    check(node,
                        node.value,
                        node.loc.start.line)
                }
            },
            TemplateElement(node) {
                check(node,
                    node.value.raw ?? "",
                    node.loc.start.line)
            },
        }
    },
}

// ── 10. no-emoji ─────────────────────────────────────────────────────────────────────────────
// Emoji carry tone, not information, and render inconsistently across terminals, logs and
// diffs. Deliberately NARROW ranges: the pictographic + dingbat + misc-symbol blocks only.
// It must never fire on the typography this codebase's own JSDoc relies on — the arrow `→`
// (U+2192), the em dash `—`, the middle dot `·`, `§` — so the arrow and general-punctuation
// blocks are excluded by construction.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u

const noEmoji = {
    meta: {
        type: "problem",
        docs: {
            description: "No emoji in source — comments, JSDoc or literals.",
        },
        schema: [],
        messages: {
            emoji: "Emoji in source. Say it in words: emoji carry tone rather than information and render inconsistently in terminals, logs and diffs.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode || context.getSourceCode()

        return {
            Program() {
                for (const comment of sourceCode.getAllComments()) {
                    if (EMOJI.test(comment.value)) {
                        context.report({
                            node: comment,
                            messageId: "emoji",
                        })
                    }
                }
            },
            Literal(node) {
                if (typeof node.value === "string" && EMOJI.test(node.value)) {
                    context.report({
                        node,
                        messageId: "emoji",
                    })
                }
            },
            TemplateElement(node) {
                if (EMOJI.test(node.value.raw ?? "")) {
                    context.report({
                        node,
                        messageId: "emoji",
                    })
                }
            },
        }
    },
}

// ── 11. no-ai-symbol ─────────────────────────────────────────────────────────────────────────
// Typographic punctuation nobody reaches for on a keyboard — the em dash, the arrow, the
// middle dot — reads as machine-written, and it is a real portability tax besides: this repo
// has already lost measurements to shell tools mangling non-ASCII. Comments stay ASCII, and
// every banned character has an exact ASCII spelling, so the rule is auto-fixable: one
// `eslint --fix` converts the whole backlog with no judgement calls.
//
// COMMENTS ONLY. A string literal can be user-facing copy or a value the code matches on;
// rewriting one is a product decision, not a lint fix.
const AI_SYMBOLS = {
    "—": "--",
    "–": "-",
    "→": "->",
    "⇒": "=>",
    "←": "<-",
    "·": "-",
    "…": "...",
    "•": "-",
    "×": "x",
    "≥": ">=",
    "≤": "<=",
    "≠": "!=",
    "“": "\"",
    "”": "\"",
    "‘": "'",
    "’": "'",
}
const AI_SYMBOL_RE = new RegExp(`[${Object.keys(AI_SYMBOLS).join("")}]`, "g")

const noAiSymbol = {
    meta: {
        type: "problem",
        fixable: "whitespace",
        docs: {
            description: "Comments are ASCII — no em dash, arrow, middle dot or smart quote.",
        },
        schema: [],
        messages: {
            symbol: "`{{symbol}}` in a comment — write `{{ascii}}`. Comments stay ASCII: typographic punctuation reads as machine-written and breaks shell tooling.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode || context.getSourceCode()

        return {
            Program() {
                for (const comment of sourceCode.getAllComments()) {
                    const found = comment.value.match(AI_SYMBOL_RE)
                    if (!found) continue
                    const symbol = found[0]
                    context.report({
                        node: comment,
                        messageId: "symbol",
                        data: {
                            symbol,
                            ascii: AI_SYMBOLS[symbol],
                        },
                        fix(fixer) {
                            const raw = sourceCode.getText().slice(comment.range[0],
                                comment.range[1])
                            return fixer.replaceTextRange(
                                comment.range,
                                raw.replace(AI_SYMBOL_RE, (ch) => AI_SYMBOLS[ch]),
                            )
                        },
                    })
                }
            },
        }
    },
}

// ── 13. no-non-global-module-import ──────────────────────────────────────────
// naming-and-structure.md §8: a @Module under src/modules or src/features wires
// only its own providers. In-repo modules are registered globally, once, at the
// app composition root (apps/*/src/**). Cross-capability entries in `imports`
// are the bug -- Nest will resolve the foreign providers locally, so the module
// graph pretends to declare a dependency that the design says is ambient.
//
// Decision on SomeModule.register({...}) (do not silently pick one):
//   Same-capability nesting -- bare `ChildModule` or `ChildModule.register(...)`
//   / `registerAsync` / `forRoot` / `forRootAsync` / `forFeature` /
//   `forFeatureAsync` / `registerQueue` -- is ALLOWED. That is a module nesting
//   its own sub-modules (canon §3) or an aggregator registering leaves (canon
//   §5). AiPingModule.register, EventBusModule.register and
//   CdnSynchronizerModule.register are this shape: relative, same capability.
//   Cross-capability `.register()` is BANNED outright, same as a bare
//   identifier. Per-instance options of a foreign module belong at
//   `apps/*/src/**` next to `isGlobal: true`. Allowing any `.register()` would
//   let `CryptoModule.register({})` silence the rule without moving composition
//   to the app root -- the fake-fix this choice exists to prevent.
//
// Allowed without further checks:
//   - third-party specifiers (anything that is not relative / @modules /
//     @features / @tests). Starting list from this repo, not memory:
//     TypeOrmModule, CqrsModule, ConfigModule, JwtModule, ScheduleModule,
//     GraphQLModule (@nestjs/graphql), MailerModule (@nestjs-modules/mailer),
//     SentryModule (@sentry/nestjs), NestBullModule (@nestjs/bullmq),
//     ThrottlerCoreModule (@nestjs/throttler). Widen by specifier origin, not
//     by name -- the in-repo BullModule / CacheModule / HttpModule wrappers
//     share names with Nest packages and must NOT ride an allow-list.
//   - files outside src/modules/** and src/features/** (app roots live under
//     apps/*/src/**; that is where the wiring is supposed to live).
//
// Visits both `@Module({ imports })` and every static method's returned object
// literal `imports` (register / forRoot / forFeature / private helpers / ...).
// Skipping dynamic returns is how a rule reports 11 and hides the rest.
// Spreads of a local array are followed (init + `.push`). Nested `imports`
// inside a third-party `forRootAsync({ imports })` options object are NOT
// walked -- that is async-factory DI wiring, not this module's own imports.
//
// Cost (also in canon §8): removing module-to-module imports makes the
// dependency graph implicit. Today, moving or deleting a module breaks
// compilation at every importer. After this change nothing points at it, so
// the same mistake surfaces at runtime as an unresolved provider, in whichever
// app happened to load it. nest build will not catch that.

const IN_REPO_SPECIFIER = /^(?:\.\.?(?:\/|$)|@modules\/|@features\/|@tests\/)/

function capabilityKey(filePath) {
    const norm = String(filePath).replace(/\\/g, "/")
    const modulesIdx = norm.lastIndexOf("/src/modules/")
    if (modulesIdx !== -1) {
        const parts = norm.slice(modulesIdx + "/src/modules/".length).split("/")
        if (MODULES_META_ROOTS.has(parts[0]) && parts[1]) {
            return `modules:${parts[0]}/${parts[1]}`
        }
        if (parts[0]) return `modules:${parts[0]}`
        return null
    }
    const featuresIdx = norm.lastIndexOf("/src/features/")
    if (featuresIdx !== -1) {
        const name = norm.slice(featuresIdx + "/src/features/".length).split("/")[0]
        return name ? `features:${name}` : null
    }
    return null
}

function repoSrcRoot(filename) {
    const norm = String(filename).replace(/\\/g, "/")
    const idx = norm.lastIndexOf("/src/")
    if (idx === -1) return null
    return norm.slice(0, idx)
}

function existingFile(baseWithoutExt) {
    for (const ext of [".ts", ".tsx", ".js", ".mjs", ".cts", ".mts"]) {
        const candidate = baseWithoutExt + ext
        if (fs.existsSync(candidate)) return candidate.replace(/\\/g, "/")
    }
    for (const ext of [".ts", ".tsx", ".js"]) {
        const candidate = path.join(baseWithoutExt, `index${ext}`)
        if (fs.existsSync(candidate)) return candidate.replace(/\\/g, "/")
    }
    return `${baseWithoutExt}.ts`.replace(/\\/g, "/")
}

function resolveSpecifier(filename, specifier) {
    if (typeof specifier !== "string") return null
    const srcRoot = repoSrcRoot(filename)
    if (!srcRoot) return null
    if (specifier.startsWith("@modules/")) {
        return existingFile(path.join(srcRoot, "src/modules", specifier.slice("@modules/".length)))
    }
    if (specifier.startsWith("@features/")) {
        return existingFile(path.join(srcRoot, "src/features", specifier.slice("@features/".length)))
    }
    if (specifier.startsWith("@tests/")) {
        return existingFile(path.join(srcRoot, "src/tests", specifier.slice("@tests/".length)))
    }
    if (specifier.startsWith(".")) {
        const fromDir = path.dirname(filename)
        return existingFile(path.resolve(fromDir, specifier))
    }
    return null
}

function findVariable(scope, name) {
    let current = scope
    while (current) {
        const found = current.variables.find((v) => v.name === name)
        if (found) return found
        current = current.upper
    }
    return null
}

function propertyNamed(objectExpr, name) {
    if (!objectExpr || objectExpr.type !== "ObjectExpression") return null
    for (const prop of objectExpr.properties) {
        if (prop.type !== "Property" || prop.computed) continue
        const key = prop.key
        const keyName = key.type === "Identifier" ? key.name
            : key.type === "Literal" ? key.value
                : null
        if (keyName === name) return prop.value
    }
    return null
}

function unwrapForwardRef(call) {
    if (call.callee.type !== "Identifier" || call.callee.name !== "forwardRef") return null
    const fn = call.arguments[0]
    if (!fn || (fn.type !== "ArrowFunctionExpression" && fn.type !== "FunctionExpression")) return null
    const body = fn.body
    if (body.type === "Identifier") return body
    if (body.type === "BlockStatement") {
        for (const stmt of body.body) {
            if (stmt.type === "ReturnStatement" && stmt.argument && stmt.argument.type === "Identifier") {
                return stmt.argument
            }
        }
    }
    return null
}

const noNonGlobalModuleImport = {
    meta: {
        type: "problem",
        docs: {
            description:
                "A module under src/modules or src/features must not import a cross-capability in-repo module. [[naming-and-structure §8]]",
        },
        schema: [],
        messages: {
            cross: "`{{name}}` is an in-repo module from another capability (`{{from}}` -> `{{to}}`). Register it globally at the app composition root (`apps/*/src/**`) instead of importing it here (no-non-global-module-import, naming-and-structure §8).",
            crossEmpty: "`{{name}}` is an in-repo module from another capability (`{{from}}` -> `{{to}}`) and its `{{method}}()` carries no configuration, so it is a plain import wearing a call. Register it globally at the app composition root (`apps/*/src/**`) (no-non-global-module-import, naming-and-structure §8).",
            crossGlobalOnly: "`{{name}}` is an in-repo module from another capability (`{{from}}` -> `{{to}}`) and its `{{method}}()` sets only `isGlobal` -- a feature declaring app-wide visibility on the app's behalf. Move that registration to `apps/*/src/**` (no-non-global-module-import, naming-and-structure §8).",
            crossConfigAndGlobal: "`{{name}}` is configured for THIS module (`{{method}}()`) yet also marked `isGlobal: true` -- the two contradict. Keep the per-instance options and drop `isGlobal`, or move the whole registration to `apps/*/src/**` (no-non-global-module-import, naming-and-structure §8).",
        },
    },
    create(context) {
        const filename = context.filename || context.getFilename()
        const selfCapability = capabilityKey(filename)
        if (!selfCapability) return {}

        const sourceCode = context.sourceCode || context.getSourceCode()
        const importSourceByLocal = new Map()

        function recordImport(node) {
            if (!node.source || typeof node.source.value !== "string") return
            const source = node.source.value
            for (const spec of node.specifiers) {
                if (spec.type === "ImportSpecifier" || spec.type === "ImportDefaultSpecifier" || spec.type === "ImportNamespaceSpecifier") {
                    importSourceByLocal.set(spec.local.name, source)
                }
            }
        }

        function reportIfForeign(idNode, messageId = "cross", extra = {
        }) {
            if (!idNode || idNode.type !== "Identifier") return
            const source = importSourceByLocal.get(idNode.name)
            if (source === undefined) return
            if (!IN_REPO_SPECIFIER.test(source)) return
            const resolved = resolveSpecifier(filename, source)
            const otherCapability = resolved ? capabilityKey(resolved) : null
            if (!otherCapability || otherCapability === selfCapability) return
            context.report({
                node: idNode,
                messageId,
                data: {
                    name: idNode.name,
                    from: selfCapability,
                    to: otherCapability,
                    ...extra,
                },
            })
        }

        /**
         * Classify the options object a dynamic-module registration was given.
         *
         * The distinction §8 turns on is whether the call carries configuration
         * that a single global registration could not express -- `type:
         * "monolithic"` for an Apollo server, `instanceKeys: [Cache]` for an
         * ioredis connection. Those legitimately belong to ONE module and are
         * allowed to stay local. What is not allowed is a call that configures
         * nothing (a plain import wearing parentheses) or that only sets
         * `isGlobal`, which is a feature deciding app-wide visibility on the
         * app's behalf.
         *
         * Classified by CONTENT, never by key name: an allow-list of names like
         * `instanceKey` would punish a module that spells its option
         * differently, and this rule already refuses name-based reasoning for
         * third-party detection.
         */
        function classifyRegistration(call) {
            const options = call.arguments.find((arg) => arg.type === "ObjectExpression")
            if (!options) return "empty"

            const isGlobal = propertyNamed(options, "isGlobal")
            const declaresGlobal = isGlobal !== null
                && isGlobal.type === "Literal"
                && isGlobal.value === true
            const configuring = options.properties.some((prop) => {
                if (prop.type === "SpreadElement") return true
                if (prop.computed) return true
                const key = prop.key
                const name = key.type === "Identifier" ? key.name
                    : key.type === "Literal" ? key.value
                        : null
                return name !== "isGlobal"
            })

            if (!configuring) return declaresGlobal ? "globalOnly" : "empty"
            return declaresGlobal ? "configAndGlobal" : "configured"
        }

        function checkCall(call) {
            const forwarded = unwrapForwardRef(call)
            if (forwarded) {
                reportIfForeign(forwarded)
                return
            }
            if (call.callee.type === "Identifier") {
                reportIfForeign(call.callee)
                return
            }
            if (call.callee.type === "MemberExpression" && !call.callee.computed) {
                const method = call.callee.property.type === "Identifier"
                    ? call.callee.property.name
                    : "register"
                const verdict = classifyRegistration(call)
                if (verdict === "configured") return
                const messageId = verdict === "globalOnly" ? "crossGlobalOnly"
                    : verdict === "configAndGlobal" ? "crossConfigAndGlobal"
                        : "crossEmpty"
                reportIfForeign(call.callee.object,
                    messageId,
                    {
                        method,
                    })
            }
        }

        function checkElement(node, seen) {
            if (!node) return
            if (seen.has(node)) return
            seen.add(node)
            if (node.type === "SpreadElement") {
                checkElement(node.argument, seen)
                return
            }
            if (node.type === "Identifier") {
                const scope = sourceCode.getScope(node)
                const variable = findVariable(scope, node.name)
                if (!variable) {
                    reportIfForeign(node)
                    return
                }
                const isImport = variable.defs.some((d) => d.type === "ImportBinding")
                if (isImport) {
                    reportIfForeign(node)
                    return
                }
                for (const def of variable.defs) {
                    if (def.type !== "Variable" || !def.node.init) continue
                    const init = def.node.init
                    if (init.type === "ArrayExpression") {
                        for (const el of init.elements) checkElement(el, seen)
                    } else if (init.type === "CallExpression") {
                        checkCall(init)
                    } else if (init.type === "Identifier") {
                        checkElement(init, seen)
                    }
                }
                for (const ref of variable.references) {
                    const parent = ref.identifier.parent
                    if (
                        parent
                        && parent.type === "MemberExpression"
                        && parent.object === ref.identifier
                        && !parent.computed
                        && parent.property.name === "push"
                        && parent.parent
                        && parent.parent.type === "CallExpression"
                    ) {
                        for (const arg of parent.parent.arguments) checkElement(arg, seen)
                    }
                }
                return
            }
            if (node.type === "CallExpression") {
                checkCall(node)
                return
            }
            if (node.type === "ArrayExpression") {
                for (const el of node.elements) checkElement(el, seen)
            }
        }

        function checkImportsValue(value) {
            if (!value) return
            checkElement(value, new Set())
        }

        function checkObjectImports(objectExpr) {
            checkImportsValue(propertyNamed(objectExpr, "imports"))
        }

        return {
            ImportDeclaration: recordImport,
            ClassDeclaration(node) {
                const decorators = node.decorators || []
                for (const dec of decorators) {
                    const expr = dec.expression
                    if (
                        expr
                        && expr.type === "CallExpression"
                        && expr.callee.type === "Identifier"
                        && expr.callee.name === "Module"
                        && expr.arguments[0]
                        && expr.arguments[0].type === "ObjectExpression"
                    ) {
                        checkObjectImports(expr.arguments[0])
                    }
                }
            },
            ReturnStatement(node) {
                let parent = node.parent
                let inStaticMethod = false
                while (parent) {
                    if (parent.type === "MethodDefinition" && parent.static) {
                        inStaticMethod = true
                        break
                    }
                    if (parent.type === "FunctionDeclaration" || parent.type === "ClassDeclaration") break
                    parent = parent.parent
                }
                if (!inStaticMethod || !node.argument) return
                if (node.argument.type === "ObjectExpression") {
                    checkObjectImports(node.argument)
                    return
                }
                if (node.argument.type === "Identifier") {
                    const scope = sourceCode.getScope(node)
                    const variable = findVariable(scope, node.argument.name)
                    if (!variable) return
                    for (const def of variable.defs) {
                        if (def.type === "Variable" && def.node.init && def.node.init.type === "ObjectExpression") {
                            checkObjectImports(def.node.init)
                        }
                    }
                }
            },
        }
    },
}

// ── 18. must-use-cache-service ───────────────────────────────────────────────────────────────
// caching. `CacheService` is the seam that decides memory vs redis and owns the key discipline;
// reaching for a raw cache manager bypasses both. Measured: every raw-token site is inside the
// cache module's own implementation, where it belongs, so this lands at zero debt.
const CACHE_TOKENS = /^(REDIS_CACHE_MANAGER|MEMORY_CACHE_MANAGER|CACHE_MANAGER)$/
const mustUseCacheService = {
    meta: {
        type: "problem",
        docs: { description: "Caching goes through `CacheService`; raw cache-manager tokens stay inside the cache module. [[caching]]" },
        schema: [],
        messages: {
            raw: "`{{token}}` is a cache-manager token. Inject `CacheService` instead -- it owns the memory/redis choice and the key discipline, and both are lost when a caller reaches past it (caching).",
        },
    },
    create(context) {
        const filename = (context.filename || context.getFilename()).split("\\").join("/")
        // the wrapper's own implementation is where these tokens are supposed to appear
        if (filename.includes("/modules/integrations/cache/")) return {}
        return {
            Identifier(node) {
                if (!CACHE_TOKENS.test(node.name)) return
                // only flag a real reference, not a property key of the same spelling
                if (node.parent && node.parent.type === "Property" && node.parent.key === node && !node.parent.computed) return
                context.report({ node, messageId: "raw", data: { token: node.name } })
            },
        }
    },
}

// ── 21. no-default-export ────────────────────────────────────────────────────────────────────
// naming-and-structure. A default export has no name at the import site, so the same symbol
// arrives spelled three different ways and no grep finds all of them. Measured 4 of 4243, and all
// four are Jest lifecycle entry points, which Jest loads BY PATH and requires to be default --
// hence the carve-out below rather than an exception in the code.
const JEST_LIFECYCLE = /[\\/](e2e|harness)-(setup|teardown)\.ts$/
const noDefaultExport = {
    meta: {
        type: "problem",
        docs: { description: "Modules export named symbols, never a default. [[naming-and-structure]]" },
        schema: [],
        messages: {
            def: "`export default` gives the symbol no name at the import site, so the same thing arrives spelled differently in every file and no grep finds them all. Export it by name.",
        },
    },
    create(context) {
        const filename = context.filename || context.getFilename()
        // Jest loads globalSetup/globalTeardown by path and calls the default export
        if (JEST_LIFECYCLE.test(filename)) return {}
        return {
            ExportDefaultDeclaration(node) {
                context.report({ node, messageId: "def" })
            },
        }
    },
}

export default {
    meta: { name: "eslint-plugin-starci-be-local", version: "0.1.0" },
    rules: {
        "must-use-cache-service": mustUseCacheService,
        "no-ai-symbol": noAiSymbol,
        "no-default-export": noDefaultExport,
        "no-emoji": noEmoji,
        "no-nest-logger": noNestLogger,
        "no-non-global-module-import": noNonGlobalModuleImport,
        "no-vietnamese": noVietnamese,
    },
}
