/**
 * The rule that keeps a secret or a person out of a log line.
 *
 * `no-secret-in-log` (R71 `BE_LOG_SECRET`) reads the arguments of a logger call and refuses a value whose name
 * says it is a credential (`password`, `secret`, `apiKey`, `accessToken`, `authorization`, `cookie`, `otp`) or
 * a personal identifier (`email`, `phone`, `fullName`, `idCard`, `birthDate`). A log line outlives the request,
 * is copied to a vendor, and is read by people who never had the credential or the consent. Log an id, a count,
 * or a masked form instead.
 *
 * The check is on names, because a parser sees names. A name that says it is a measurement of a credential
 * (`tokenCount`, `tokenType`, `secretName`) is not the credential, so those endings are exempt.
 */
import { wordsOf } from "./lib/ast.mjs"
import { isDeclarationFile, isTestLane } from "./lib/path.mjs"

const LOG_METHODS = new Set(["log", "error", "warn", "info", "debug", "verbose", "fatal", "trace"])

/** A receiver is a logger when its last name says so. */
const isLoggerReceiver = (node) => {
  const name = node.type === "Identifier"
    ? node.name
    : node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier"
      ? node.property.name
      : null
  return name !== null && /^(?:logger|log|winstonService|loggingService|appLogger)$/i.test(name)
}

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

const isPiiName = (words) => !words.some((word) => MEASURE_WORDS.has(word)) && words.some((word) => PII_WORDS.has(word))

/** A call that hides its argument: the value shown is a mask, a hash, a flag or a count. */
const isHidingCall = (node) =>
  node.type === "CallExpression"
  && node.callee.type === "Identifier"
  && /^(?:mask|redact|hash|fingerprint|last4|truncate|Boolean|Number|String)$|^(?:mask|redact|hash|fingerprint)/i.test(node.callee.name)

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

/** A logger call names no credential and no personal identifier. */
export const noSecretInLog = {
  meta: {
    type: "problem",
    docs: { description: "Arguments of a logger call carry no credential and no personal identifier by name." },
    schema: [],
    messages: {
      secret:
        "`{{name}}` reads as a credential and is passed to a logger. Log lines outlive the request and are copied to vendors. Log whether it was present, its length, or a masked form (`mask(...)`), never the value.",
      pii:
        "`{{name}}` reads as a personal identifier and is passed to a logger. Log the owning id instead, or a masked form (`mask(...)`), never the raw value.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isTestLane(filename) || isDeclarationFile(filename)) return {}
    return {
      CallExpression(node) {
        const { callee } = node
        if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return
        if (!LOG_METHODS.has(callee.property.name) || !isLoggerReceiver(callee.object)) return
        const reported = new Set()
        for (const argument of node.arguments) {
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
