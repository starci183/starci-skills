/**
 * The rules that keep a database call safe to run in production.
 *
 * - `no-interpolated-sql` (R68 `BE_SQL_INTERPOLATED`) refuses SQL text built from a runtime value. A value
 *   reaches the statement as a numbered parameter (`$1`), never as spliced text.
 * - `query-needs-limit` (R69 `BE_QUERY_UNBOUNDED`) refuses a read that returns every matching row. A list read
 *   states its bound: `take`, `limit`, `LIMIT`, or a page cursor.
 *
 * Both read one file's syntax only. Where the syntax cannot prove a call safe or unsafe (a statement held in a
 * variable, an options object built elsewhere) the rule stays silent: a rule that guesses teaches authors to
 * ignore it.
 */
import { keyName, staticText, walk } from "./lib/ast.mjs"
import { isDeclarationFile, isTestLane, normalizePath } from "./lib/path.mjs"

const SQL_VERB = /\b(?:SELECT|INSERT|UPDATE|DELETE|WITH)\b/i

/** A migration writes DDL once, by hand, with no caller input: interpolation there is a build step, not a hole. */
const isMigrationPath = (filename) => /\/migrations\/[^/]+\.[cm]?ts$/.test(normalizePath(filename))

/** The property a call goes through: `manager.query(...)` gives `query`. */
const calleeProperty = (node) =>
  node.callee.type === "MemberExpression" && !node.callee.computed && node.callee.property.type === "Identifier"
    ? node.callee.property.name
    : null

/** The last name of the receiver: `this.manager` gives `manager`, `em` gives `em`. */
const receiverName = (callee) => {
  const object = callee.object
  if (object.type === "Identifier") return object.name
  if (object.type === "MemberExpression" && !object.computed && object.property.type === "Identifier") return object.property.name
  return null
}

/** UPPER_SNAKE names a module constant: a fixed column list is code, not input. */
const isConstantName = (name) => /^[A-Z][A-Z0-9_]*$/.test(name)

/** Identifier helpers that quote an identifier are the sanctioned way to put a name into a statement. */
const IDENT_HELPERS = new Set(["quoteIdent", "quoteIdentifier", "quoteIdentifiers", "sqlIdent", "sqlIdentifiers", "sqlSetClause", "escapeIdentifier"])

/** Whether a substitution inside a SQL template is one of the shapes that cannot carry input. */
const isSafeSubstitution = (expression, precedingText) => {
  if (precedingText.endsWith("$")) return true
  if (expression.type === "Identifier") return isConstantName(expression.name)
  if (expression.type === "MemberExpression" && !expression.computed && expression.property.type === "Identifier") {
    return isConstantName(expression.property.name)
  }
  if (expression.type === "CallExpression" && expression.callee.type === "Identifier") return IDENT_HELPERS.has(expression.callee.name)
  // `${locked ? "FOR UPDATE" : ""}` chooses between fixed strings
  if (expression.type === "ConditionalExpression") {
    const fixed = (branch) => branch.type === "Literal" && typeof branch.value === "string"
    return fixed(expression.consequent) && fixed(expression.alternate)
  }
  return false
}

// -- R68 -----------------------------------------------------------------------------------------------

/** A statement is text plus parameters; a value never becomes part of the text. */
export const noInterpolatedSql = {
  meta: {
    type: "problem",
    docs: { description: "SQL text passed to `.query(...)` contains no runtime substitution; values are numbered parameters." },
    schema: [],
    messages: {
      interpolated:
        "This SQL text is built from `{{expression}}`. A value spliced into a statement is an injection hole and defeats the plan cache. Pass the value as a numbered parameter (`$1`) in the array argument. A column list is a module constant in UPPER_SNAKE case; a dynamic identifier goes through `quoteIdent(...)` or `sqlIdent(...)`; a variable SET list goes through `sqlSetClause(...)`, which checks every column against a fixed allowlist and numbers the placeholders. A choice between fixed strings is a ternary of literals.",
      concatenated:
        "This SQL text is joined with `+`. A value spliced into a statement is an injection hole. Pass the value as a numbered parameter (`$1`) in the array argument.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isTestLane(filename) || isDeclarationFile(filename) || isMigrationPath(filename)) return {}
    const sourceCode = context.sourceCode || context.getSourceCode()
    return {
      CallExpression(node) {
        if (calleeProperty(node) !== "query") return
        const first = node.arguments[0]
        if (!first) return
        if (first.type === "TemplateLiteral" && first.expressions.length > 0) {
          const text = first.quasis.map((quasi) => quasi.value.cooked ?? "").join(" ")
          if (!SQL_VERB.test(text)) return
          first.expressions.forEach((expression, index) => {
            const preceding = first.quasis[index]?.value.cooked ?? ""
            if (isSafeSubstitution(expression, preceding)) return
            context.report({ node: expression, messageId: "interpolated", data: { expression: sourceCode.getText(expression).slice(0, 60) } })
          })
        } else if (first.type === "BinaryExpression" && first.operator === "+") {
          let sql = false
          walk(first, (child) => {
            if (child.type === "Literal" && typeof child.value === "string" && SQL_VERB.test(child.value)) sql = true
          })
          if (sql) context.report({ node: first, messageId: "concatenated" })
        }
      },
    }
  },
}

// -- R69 -----------------------------------------------------------------------------------------------

const AGGREGATE_ONLY = /^\s*(?:WITH\b[\s\S]*?\)\s*)?SELECT\s+(?:COUNT|SUM|MAX|MIN|AVG|EXISTS|NEXTVAL|NOW|CURRENT_|PG_|SET_CONFIG|1\b|TRUE|FALSE|\(?\s*SELECT\s+1)/i
const HAS_BOUND = /\bLIMIT\b|\bFETCH\s+FIRST\b/i
/** A lookup by the primary key returns one row, so it needs no bound. */
const BY_PRIMARY_KEY = /\bWHERE\s+"?(?:[a-z_]+\.)?id"?\s*=\s*\$\d+\s*(?:FOR\s+UPDATE\s*)?(?:RETURNING[^;]*)?$/i

const QUERY_BUILDER_READS = new Set(["getMany", "getRawMany", "getManyAndCount", "getRawAndEntities"])
const REPOSITORY_READS = new Set(["find", "findBy", "findAndCount", "findAndCountBy"])
const REPOSITORY_RECEIVER = /^(?:manager|entityManager|em|repo|repository|[a-z]\w*Repository|[a-z]\w*Repo)$/

/** The chain of calls a query builder read hangs off, as method names, innermost first. */
const chainNames = (callee) => {
  const names = []
  let current = callee
  while (current) {
    if (current.type === "MemberExpression" && !current.computed && current.property.type === "Identifier") {
      names.push(current.property.name)
      current = current.object
    } else if (current.type === "CallExpression") {
      current = current.callee
    } else if (current.type === "AwaitExpression") {
      current = current.argument
    } else break
  }
  return names
}

/** Whether an object literal names a property, by key. */
const objectHasKey = (node, names) =>
  node?.type === "ObjectExpression" && node.properties.some((property) => property.type === "Property" && names.includes(keyName(property.key)))

/** Whether a `where` object states the primary key, which bounds the read to one row. */
const whereHasPrimaryKey = (node) => {
  if (node?.type !== "ObjectExpression") return false
  if (objectHasKey(node, ["id"])) return true
  const where = node.properties.find((property) => property.type === "Property" && keyName(property.key) === "where")
  return where ? whereHasPrimaryKey(where.value) : false
}

/** A list read states its bound. */
export const queryNeedsLimit = {
  meta: {
    type: "problem",
    docs: { description: "A read that can return many rows states `take`, `limit` or `LIMIT`." },
    schema: [],
    messages: {
      builder:
        "`.{{method}}()` reads every matching row: one busy tenant turns it into a full scan held in memory. Add `.take(n)` (or `.limit(n)`) with a named bound, or page with a cursor.",
      find:
        "`.{{method}}(...)` on a repository reads every matching row and states no `take`. Pass `take` with a named bound (the entity manager form is `manager.find(Entity, { where, take })`), or page with a cursor. A lookup by `id` is exempt.",
      findBy:
        "`.findBy(...)` cannot take a bound, so it reads every matching row. Use `.find({ where, take })` with a named bound, or page with a cursor. A lookup by `id` is exempt.",
      raw:
        "This `SELECT` has no `LIMIT`. Add `LIMIT $n` with a named bound, or page by keyset. An aggregate (`COUNT`, `EXISTS`, `SUM`) and a lookup by `id` are exempt.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isTestLane(filename) || isDeclarationFile(filename) || isMigrationPath(filename)) return {}
    return {
      CallExpression(node) {
        const method = calleeProperty(node)
        if (!method) return
        if (QUERY_BUILDER_READS.has(method)) {
          const names = chainNames(node.callee.object.type === "CallExpression" ? node.callee.object.callee : node.callee.object)
          if (names.includes("take") || names.includes("limit") || names.includes("getOne") || names.includes("getOneOrFail")) return
          if (!names.includes("createQueryBuilder") && !names.includes("select") && !names.includes("where") && !names.includes("andWhere") && !names.includes("leftJoinAndSelect") && !names.includes("innerJoinAndSelect") && !names.includes("orderBy") && !names.includes("from")) return
          context.report({ node: node.callee.property, messageId: "builder", data: { method } })
          return
        }
        if (REPOSITORY_READS.has(method) && REPOSITORY_RECEIVER.test(receiverName(node.callee) ?? "")) {
          const args = node.arguments
          // manager.find(Entity, options) has the entity first; repository.find(options) has the options first
          const options = method === "find" || method === "findAndCount" ? args.find((arg) => arg.type === "ObjectExpression") : undefined
          const where = method === "findBy" || method === "findAndCountBy" ? args.find((arg) => arg.type === "ObjectExpression") : undefined
          if (method === "find" || method === "findAndCount") {
            const argument = args[args.length - 1]
            if (!argument || argument.type !== "ObjectExpression") return // no static options to judge
            if (objectHasKey(options, ["take", "limit"]) || whereHasPrimaryKey(options)) return
            context.report({ node: node.callee.property, messageId: "find", data: { method } })
          } else if (where) {
            if (whereHasPrimaryKey(where)) return
            context.report({ node: node.callee.property, messageId: "findBy", data: { method } })
          }
          return
        }
        if (method === "query") {
          const text = staticText(node.arguments[0])
          const sql = text ?? (node.arguments[0]?.type === "TemplateLiteral" ? node.arguments[0].quasis.map((quasi) => quasi.value.cooked ?? "").join(" ") : null)
          if (sql === null) return
          if (!/^\s*(?:SELECT|WITH)\b/i.test(sql)) return
          if (HAS_BOUND.test(sql) || AGGREGATE_ONLY.test(sql) || BY_PRIMARY_KEY.test(sql.trim().replace(/;$/, ""))) return
          context.report({ node: node.arguments[0], messageId: "raw" })
        }
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-interpolated-sql": noInterpolatedSql,
  "query-needs-limit": queryNeedsLimit,
}

/** Both start at error: no baseline exists, and the repositories' fix lanes clear the debt. */
export const recommended = {
  "starci-be/no-interpolated-sql": "error",
  "starci-be/query-needs-limit": "error",
}
