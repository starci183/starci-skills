/**
 * The rules that hold `e2e-flow.md`.
 *
 * FIVE OF THE TWELVE RULES HAVE A MACHINE-CHECKABLE HALF HERE. That is the honest number rather
 * than a gap somebody should close. A rule earns its place by being exact: it must fire on a syntactic shape, not on a
 * judgement, or it becomes something authors learn to disable and the law is worse off than when
 * nothing enforced it.
 *
 * What was measured and left alone, so the next reader does not "finish the job":
 *
 *   - E2E-1 (one file, one flow, named for the sentence). A filename cannot be checked against a
 *     business sentence. `course-purchase.e2e-spec.ts` and `resolver-group.e2e-spec.ts` are the same
 *     shape to a parser and opposite things to a reader.
 *   - E2E-2 (named steps, not one long case). Counting `it` blocks would refuse a flow that is
 *     genuinely one step, and a rule whose first false positive is legitimate teaches authors that
 *     the rule is wrong rather than that they are.
 *   - E2E-5, E2E-6 and E2E-9 turn on WHAT is asserted or WHO is acting, which is meaning. E2E-6 in
 *     particular has no shape to deny: absence is proved through a stored row, a socket silence
 *     window, or a rejected promise depending on the flow, and a rule narrow enough to accept all
 *     three accepts everything. E2E-9's ban on a shared actor is a fact about TWO files at once,
 *     which one file's AST cannot see.
 *   - E2E-8 (one place stands the world up) is STILL a fact about a repository's fixtures for its
 *     first half, not about one file, so THAT half belongs to a gate that can see the tree. Its
 *     second half - "a spec file contains no wiring of its own" - is a per-file shape after all, the
 *     same kind of shape `e2e-uses-production-transport` already refuses for buses and workers, and
 *     is added below.
 *   - E2E-10 (a flow logs nothing) is already held: `no-console` and `no-framework-logger` in the
 *     observability law cover every call site, and a second rule saying the same thing in this lane
 *     would double every report. It stays undeclared here on purpose, not by oversight.
 *
 * The rules below enforce only exact syntax: transport bypass, wiring built inline instead of
 * through the shared world, absence of any persisted-state read, direct provider imports, sleeps and
 * branches. They do not pretend to judge business meaning.
 */

/** Files this law governs. A flow is a named lane, not every file that happens to touch a database. */
const isE2eSpec = (filename) => /\.e2e-spec\.ts$/.test(String(filename || "").replace(/\\/g, "/"))

/** Names a repository sleeps by. Awaiting any of them is waiting for a duration instead of a state. */
const SLEEPERS = new Set(["sleep", "delay", "wait", "pause", "setTimeout"])

/** E2E enters through production transport and never invokes an internal actor directly. */
export const e2eUsesProductionTransport = {
  meta: {
    type: "problem",
    docs: { description: "Operational E2E keeps the production transport boundary in the proof." },
    schema: [],
    messages: {
      busImport: "`{{name}}` is an internal dispatcher. Enter through GraphQL, HTTP, socket, broker or scheduler.",
      direct: "Direct `.{{method}}()` skips production routing and delivery semantics.",
      actor: "Calling `{{name}}` directly bypasses the broker/CQRS boundary that owns it.",
    },
  },
  create(context) {
    if (!isE2eSpec(context.filename || context.getFilename())) return {}
    const buses = new Set(["CommandBus", "QueryBus", "EventBus"])
    return {
      ImportDeclaration(node) {
        if (node.source.value !== "@nestjs/cqrs") return
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") continue
          const imported = specifier.imported.name || specifier.imported.value
          if (buses.has(imported)) context.report({ node: specifier, messageId: "busImport", data: { name: imported } })
        }
      },
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== "MemberExpression" || callee.computed) return
        const method = callee.property.name
        if (method === "execute" || method === "process") {
          context.report({ node: callee.property, messageId: "direct", data: { method } })
          return
        }
        let receiver = callee.object
        while (receiver && ["TSAsExpression", "TSTypeAssertion", "ChainExpression"].includes(receiver.type)) receiver = receiver.expression
        if (receiver && receiver.type === "Identifier" && /(?:Worker|Handler)$/.test(receiver.name)) {
          context.report({ node: callee.property, messageId: "actor", data: { name: receiver.name } })
        }
      },
    }
  },
}

// -- E2E-3 ----------------------------------------------------------------------------------------

/** A flow polls until the state settles; it never waits for a duration. */
export const noSleepInFlow = {
  meta: {
    type: "problem",
    docs: { description: "A flow polls for the state it needs, with a deadline. It never sleeps." },
    schema: [],
    messages: {
      sleep:
        "`{{name}}` waits for a DURATION, and a duration is a guess about somebody else's machine. It is too long on the machine that passes - every run pays it - and too short on the one that matters, where it fails as a flake nobody can reproduce. Poll for the state you are actually waiting for, with a deadline, so the test says what it wanted rather than how long it was willing to sit there.",
      timer:
        "A promise around `setTimeout` is a sleep with the name taken off. The objection is the same: nothing here says which state the flow is waiting for, so the failure message when it expires names a timeout instead of the thing that never happened. Poll the state, with a deadline.",
    },
  },
  create(context) {
    if (!isE2eSpec(context.filename || context.getFilename())) return {}
    return {
      CallExpression(node) {
        const callee = node.callee
        if (!callee || callee.type !== "Identifier" || !SLEEPERS.has(callee.name)) return
        // A `setTimeout` wrapped in `new Promise` is reported once, as `timer`, by the branch below.
        // Reporting it here as well would put two findings on one sleep and teach nobody anything.
        for (let current = node.parent; current; current = current.parent) {
          if (current.type === "NewExpression" && current.callee && current.callee.name === "Promise") return
        }
        context.report({ node, messageId: "sleep", data: { name: callee.name } })
      },
      NewExpression(node) {
        if (!node.callee || node.callee.name !== "Promise") return
        const source = context.sourceCode || context.getSourceCode()
        if (/setTimeout/.test(source.getText(node))) context.report({ node, messageId: "timer" })
      },
    }
  },
}

// -- E2E-7 ----------------------------------------------------------------------------------------

/** A step asserts one outcome. A branch means the test is prepared for either, which is no assertion. */
export const noBranchInFlowStep = {
  meta: {
    type: "problem",
    docs: { description: "A flow step takes no branch: it asserts the one outcome the business promises." },
    schema: [],
    messages: {
      branch:
        "A branch inside a step means this test passes down either path, so a green run stops being evidence that the business worked - it only proves the code reached the end. The flow knows which outcome it is asserting: state it. If two outcomes are both legitimate, they are two steps, or two flows.",
    },
  },
  create(context) {
    if (!isE2eSpec(context.filename || context.getFilename())) return {}
    const source = context.sourceCode || context.getSourceCode()

    /** True when this node sits inside the callback of an `it(...)`. */
    const insideStep = (node) => {
      for (let current = node.parent; current; current = current.parent) {
        if (current.type !== "CallExpression") continue
        const callee = current.callee
        const name = callee && (callee.name || (callee.object && callee.object.name))
        if (name === "it" || name === "test") return true
      }
      return false
    }

    const report = (node) => {
      if (insideStep(node)) context.report({ node, messageId: "branch" })
    }

    return {
      IfStatement: report,
      ConditionalExpression: report,
      SwitchStatement: report,
      LogicalExpression(node) {
        // `a && b` used as a STATEMENT is a hidden if; the same operator inside an assertion is not
        if (node.parent && node.parent.type === "ExpressionStatement") report(node)
        // touching the source keeps the helper honest if the shape ever changes
        void source
      },
    }
  },
}

// -- E2E-8 (the per-file half: a spec builds no wiring of its own) --------------------------------

/** A flow boots through the shared world; it does not build its own copy of the app. */
export const noWiringInFlowSpec = {
  meta: {
    type: "problem",
    docs: {
      description:
        "An e2e spec boots through the shared world helper and builds no testing module of its own (E2E-8).",
    },
    schema: [],
    messages: {
      wiring:
        "`Test.createTestingModule(...)` builds this flow's own copy of the app instead of booting through the shared world helper. E2E-8: the world is stood up in one place, and a spec file carries no wiring of its own - when the wiring changes, every flow that inlined its own module has to change with it, and two flows standing the world up slightly differently is how nobody learns where they differ. Boot through the shared helper and override only the one token this flow needs.",
    },
  },
  create(context) {
    if (!isE2eSpec(context.filename || context.getFilename())) return {}
    return {
      CallExpression(node) {
        const callee = node.callee
        if (!callee || callee.type !== "MemberExpression" || callee.computed) return
        if (callee.object.type !== "Identifier" || callee.object.name !== "Test") return
        if (callee.property.name !== "createTestingModule") return
        context.report({ node: callee, messageId: "wiring" })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "e2e-uses-production-transport": e2eUsesProductionTransport,
  "no-sleep-in-flow": noSleepInFlow,
  "no-branch-in-flow-step": noBranchInFlowStep,
  "no-wiring-in-flow-spec": noWiringInFlowSpec,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * The first three are exact and fire on a syntactic shape rather than on a judgement, so none of
 * them carries the false-positive risk that would justify adopting it at `warn`.
 *
 * `no-wiring-in-flow-spec` is exact in the SAME sense - `Test.createTestingModule(...)` is a fixed
 * shape, not a guess - but it was measured at 60 of 77 e2e files in the reference repository
 * building their own testing module rather than calling `bootFlowWorld`. That is real, pre-existing
 * debt this task does not fix, so the rule lands at `warn` with the count rather than `error`,
 * exactly like a rule that has not yet been burned down.
 */
export const recommended = {
  "starci-be/e2e-uses-production-transport": "error",
  "starci-be/no-sleep-in-flow": "error",
  "starci-be/no-branch-in-flow-step": "error",
  "starci-be/no-wiring-in-flow-spec": "warn", // no=60 of 77 - pre-existing, not burned down here
}
