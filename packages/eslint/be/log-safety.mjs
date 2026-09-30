/**
 * The rule that keeps a secret or a person out of a log line.
 *
 * `no-secret-in-log` (R71 `BE_LOG_SECRET`) judges every call on the `Logger` port of `platform/logging` - the receiver
 * is identified by its TYPE, never by its name - and refuses two things in the fields it is given (the first argument
 * is the event and is judged by `no-interpolated-log-message`):
 *
 *   1. a value whose TYPE is the `Secret` brand of `platform/config` or the `Pii` brand of `identity`, or that is read
 *      out of one (`secret.reveal()`, `person.value`): the brand says what the value IS, whatever it is called;
 *   2. a value whose NAME says it is a credential (`password`, `secret`, `apiKey`, `accessToken`, `authorization`,
 *      `cookie`, `otp`) or a personal identifier (`email`, `phone`, `fullName`, `idCard`, `birthDate`). This is the
 *      second half the convention keeps for values that never carried a brand; a name that says it MEASURES a
 *      credential (`tokenCount`, `tokenType`, `secretName`) is not the credential, so those endings are exempt.
 *
 * A log line outlives the request, is copied to a vendor, and is read by people who never had the credential or the
 * consent. Log an id, a count, or a masked form instead.
 */
import { wordsOf } from "./lib/ast.mjs"
import { isLoggerCall, isOwnedType } from "./lib/ports.mjs"
import { isDeclarationFile } from "./lib/path.mjs"

/** The `Secret` brand of `platform/config`. */
const isSecretType = (context, node) => isOwnedType(context, node, { name: "Secret", capability: "config", tier: "platform" })

/** The `Pii` brand of the `identity` owner. */
const isPiiType = (context, node) => isOwnedType(context, node, { name: "Pii", capability: "identity" })

const SECRET_WORDS = new Set(["password", "passwd", "secret", "secrets", "apikey", "authorization", "bearer", "otp", "cookie", "cookies", "credential", "credentials", "jwt", "passphrase"])
const SECRET_PAIRS = [["api", "key"], ["private", "key"], ["access", "key"], ["secret", "key"], ["signing", "key"], ["client", "secret"]]
const PII_WORDS = new Set(["email", "emails", "phone", "phonenumber", "fullname", "idcard", "cccd", "birthdate", "dob"])
/** A name that measures or classifies a credential is not the credential. */
const MEASURE_WORDS = new Set(["count", "counts", "id", "ids", "type", "types", "name", "names", "ttl", "expiry", "expires", "expiresat", "limit", "usage", "used", "budget", "max", "min", "input", "output", "total", "length", "kind", "hash", "hashed", "masked", "present", "provided", "configured", "exists", "has", "is", "reason", "status", "prefix", "suffix", "version", "rotated", "at", "summary", "source", "from", "fixture", "seed"])

/** Whether a name spells a credential, given its words. */
const isSecretName = (words) => {
  if (words.some((word) => MEASURE_WORDS.has(word))) return false
  if (words.some((word) => SECRET_WORDS.has(word))) return true
  if (words.includes("token") || words.includes("tokens")) return true
  return SECRET_PAIRS.some(([a, b]) => words.some((word, index) => word === a && words[index + 1] === b))
}

const PII_PAIRS = [["full", "name"], ["birth", "date"], ["id", "card"], ["phone", "number"]]

/** Whether a name spells a personal identifier: a two-word identifier (`fullName`) or a single word, unless the name measures one. */
const isPiiName = (words) =>
  PII_PAIRS.some(([a, b]) => words.some((word, index) => word === a && words[index + 1] === b))
  || (!words.some((word) => MEASURE_WORDS.has(word)) && words.some((word) => PII_WORDS.has(word)))

/** A call that hides its argument: the value shown is a mask, a hash, a flag or a count. */
const isHidingCall = (node) =>
  node.type === "CallExpression"
  && node.callee.type === "Identifier"
  && /^(?:mask|redact|hash|fingerprint|last4|truncate|Boolean|Number|String)$|^(?:mask|redact|hash|fingerprint)/i.test(node.callee.name)

/**
 * The expressions whose TYPE an argument passes on: identifiers, member reads, call results, and what they are read
 * out of. A call to a masking function shows a mask, so its arguments are not followed.
 */
const valuesIn = (node, found = []) => {
  if (!node || typeof node.type !== "string") return found
  switch (node.type) {
    case "Identifier":
      found.push(node)
      return found
    case "MemberExpression":
      found.push(node)
      return valuesIn(node.object, found)
    case "CallExpression":
      if (isHidingCall(node)) return found
      found.push(node)
      if (node.callee.type === "MemberExpression") valuesIn(node.callee.object, found)
      return found
    case "ObjectExpression":
      node.properties.forEach((property) => valuesIn(property, found))
      return found
    case "Property":
      return valuesIn(node.value, found)
    case "ArrayExpression":
      node.elements.forEach((element) => valuesIn(element, found))
      return found
    case "TemplateLiteral":
      node.expressions.forEach((expression) => valuesIn(expression, found))
      return found
    case "BinaryExpression":
    case "LogicalExpression":
      valuesIn(node.left, found)
      return valuesIn(node.right, found)
    case "ConditionalExpression":
      valuesIn(node.consequent, found)
      return valuesIn(node.alternate, found)
    case "SpreadElement":
    case "AwaitExpression":
      return valuesIn(node.argument, found)
    case "TSAsExpression":
    case "TSNonNullExpression":
    case "TSSatisfiesExpression":
      return valuesIn(node.expression, found)
    default:
      return found
  }
}

/** The names an argument reads: identifiers, member properties and object keys, not nested function bodies. */
const namesIn = (node, found = []) => {
  if (!node || typeof node.type !== "string") return found
  switch (node.type) {
    case "Identifier":
      found.push({ name: node.name, node })
      return found
    case "MemberExpression":
      // only the last name says what the value IS: `credential.fromEmail` is an address, `payload.token` is a token
      if (!node.computed && node.property.type === "Identifier") found.push({ name: node.property.name, node: node.property })
      else namesIn(node.property, found)
      return found
    case "Property":
      if (isHidingCall(node.value)) return found
      if (!node.computed && node.key.type === "Identifier") found.push({ name: node.key.name, node: node.key })
      namesIn(node.value, found)
      return found
    case "ObjectExpression":
      node.properties.forEach((property) => namesIn(property, found))
      return found
    case "ArrayExpression":
      node.elements.forEach((element) => namesIn(element, found))
      return found
    case "TemplateLiteral":
      node.expressions.forEach((expression) => namesIn(expression, found))
      return found
    case "BinaryExpression":
    case "LogicalExpression":
      namesIn(node.left, found)
      namesIn(node.right, found)
      return found
    case "ConditionalExpression":
      namesIn(node.consequent, found)
      namesIn(node.alternate, found)
      return found
    case "SpreadElement":
      return namesIn(node.argument, found)
    case "TSAsExpression":
    case "TSNonNullExpression":
      return namesIn(node.expression, found)
    case "CallExpression":
      // `mask(token)` and `redact(token)` are the sanctioned way to show a credential; any other call reads its arguments
      if (isHidingCall(node)) return found
      node.arguments.forEach((argument) => namesIn(argument, found))
      return found
    default:
      return found
  }
}

/** A logger call carries no credential and no personal identifier, by type or by name. */
export const noSecretInLog = {
  meta: {
    type: "problem",
    docs: { description: "Fields of a `Logger` call carry no `Secret`/`Pii` value and no credential or personal identifier by name." },
    schema: [],
    messages: {
      secretType:
        "`{{name}}` is a `Secret` (or is read out of one) and is passed to the logger. Log lines outlive the request and are copied to vendors. Log whether it was present, its length, or a masked form (`mask(...)`), never the value.",
      piiType:
        "`{{name}}` is `Pii` (or is read out of one) and is passed to the logger. Log the owning id instead, or a masked form (`mask(...)`), never the value.",
      secret:
        "`{{name}}` reads as a credential and is passed to a logger. Log lines outlive the request and are copied to vendors. Log whether it was present, its length, or a masked form (`mask(...)`), never the value.",
      pii:
        "`{{name}}` reads as a personal identifier and is passed to a logger. Log the owning id instead, or a masked form (`mask(...)`), never the raw value.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isDeclarationFile(filename)) return {}
    const sourceCode = context.sourceCode || context.getSourceCode()
    return {
      CallExpression(node) {
        if (!isLoggerCall(context, node)) return
        // the first argument is the event; the rest are the cause and the fields
        const fields = node.arguments.slice(1)
        const reported = new Set()
        for (const argument of fields) {
          for (const value of valuesIn(argument)) {
            if (reported.has(value)) continue
            if (isSecretType(context, value)) {
              reported.add(value)
              context.report({ node: value, messageId: "secretType", data: { name: sourceCode.getText(value) } })
            } else if (isPiiType(context, value)) {
              reported.add(value)
              context.report({ node: value, messageId: "piiType", data: { name: sourceCode.getText(value) } })
            }
          }
          for (const { name, node: at } of namesIn(argument)) {
            const words = wordsOf(name)
            if (reported.has(name)) continue
            if (isSecretName(words)) {
              reported.add(name)
              context.report({ node: at, messageId: "secret", data: { name } })
            } else if (isPiiName(words)) {
              reported.add(name)
              context.report({ node: at, messageId: "pii", data: { name } })
            }
          }
        }
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-secret-in-log": noSecretInLog,
}

/** Starts at error: no baseline exists, and the repositories' fix lanes clear the debt. */
export const recommended = {
  "starci-be/no-secret-in-log": "error",
}
