/**
 * The rules that hold `e2e-flow.md`.
 *
 * ONLY TWO OF THE TEN RULES ARE HERE, and that is the honest number rather than a gap somebody
 * should close. A rule earns its place by being exact: it must fire on a syntactic shape, not on a
 * judgement, or it becomes something authors learn to disable and the law is worse off than when
 * nothing enforced it.
 *
 * What was measured and left alone, so the next reader does not "finish the job":
 *
 *   - FLOW-1 (one file, one flow, named for the sentence). A filename cannot be checked against a
 *     business sentence. `course-purchase.e2e-spec.ts` and `resolver-group.e2e-spec.ts` are the same
 *     shape to a parser and opposite things to a reader.
 *   - FLOW-2 (named steps, not one long case). Counting `it` blocks would refuse a flow that is
 *     genuinely one step, and a rule whose first false positive is legitimate teaches authors that
 *     the rule is wrong rather than that they are.
 *   - FLOW-4, FLOW-5, FLOW-6, FLOW-9 all turn on WHAT is asserted or WHO is acting, which is meaning.
 *   - FLOW-8 (one place stands the world up) is a fact about a repository's fixtures, not about a
 *     file, so it belongs to a gate that can see the tree rather than to a rule that sees one file.
 *   - FLOW-10 (a flow logs nothing) is already held: `no-console` and `no-framework-logger` in the
 *     observability law cover every call site, and a second rule saying the same thing in this lane
 *     would double every report.
 *
 * The two below are left because they are exact, and because both fail in a way that costs hours:
 * a sleep makes a suite slow and flaky at once, and a branch in a test makes a green run mean
 * nothing at all.
 */

/** Files this law governs. A flow is a named lane, not every file that happens to touch a database. */
const isE2eSpec = (filename) => /\.e2e-spec\.ts$/.test(String(filename || "").replace(/\\/g, "/"))

/** Names a repository sleeps by. Awaiting any of them is waiting for a duration instead of a state. */
const SLEEPERS = new Set(["sleep", "delay", "wait", "pause", "setTimeout"])

// -- FLOW-3 ----------------------------------------------------------------------------------------

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

// -- FLOW-7 ----------------------------------------------------------------------------------------

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

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-sleep-in-flow": noSleepInFlow,
  "no-branch-in-flow-step": noBranchInFlowStep,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * Both are exact and both fire on a syntactic shape rather than on a judgement, so neither carries
 * the false-positive risk that would justify adopting it at `warn`.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-be/${name}`, "error"]))
