/**
 * Rules for the SERVED LOCALE law - `patterns/fe/served-locale/INDEX.md`.
 *
 * WHY THESE EXIST. An application obeyed the translation law completely - every label resolved in a
 * connected half, no literal below a block, both catalogues in step - and served a Vietnamese reader
 * an English course on a `/vi/` URL. The chrome came from the dictionary and the content came from an
 * API that was never told which language to serve, so the failure looked like a translation gap and
 * was looked for in the dictionary, where there was nothing wrong. The header was missing, and no
 * gate had anything to say about a header nobody wrote.
 *
 * WHAT THEY HOLD. That the transport chain declares a locale, and that exactly one place writes it.
 * Both are file-at-a-time facts: the chain is assembled in one file, and a header is written where it
 * is written.
 *
 * WHAT THEY CANNOT HOLD, stated rather than implied. Neither rule can tell whether the value the link
 * computes is CORRECT - whether it reads the address, the cookie or a constant - because that is
 * inside a function these rules only see the name of. A link that attaches `Accept-Language: "en"`
 * unconditionally satisfies both and is wrong. That case is a review question and LOCALE-2 is where
 * it is argued; pretending otherwise would be the rule claiming a guarantee it does not have.
 *
 * WHY THE FIRST RULE KEYS ON THE TERMINAL LINK RATHER THAN ON A FILE NAME. The clients folder (`modules/api/graphql/clients/`,
 * slot `fe.transport.client`) holds the clients, their options and every link, and a file-name pattern that guessed which of
 * them assembles the chain would either miss the real chain or fire on every helper beside it. The chain is identifiable by what it does: it builds the link
 * that talks to the network.
 *
 * WITH ONE EXEMPTION THAT WAS FOUND BY RUNNING IT, NOT BY THINKING ABOUT IT. "Constructs the
 * terminal link" is also true of the file that DEFINES that link, so the first version reported
 * `links/http.ts` and its spec on a repository that had done everything right. There was no correct
 * way to satisfy it there - a locale link inside the http link is a chain hiding in a link - and a
 * rule with no correct way to satisfy it is a finding about the rule. A file under `links/` is one
 * link; a chain is assembled elsewhere, which is where the locale belongs.
 */

import { hfsOf } from "./lib/hfs.mjs"
import { fileOf, isApiLayer, stem } from "./lib/scope.mjs"

/**
 * The name of the file when it sits directly in a `links/` folder of the API layer, else null.
 *
 * NO SLOT NAMES A LINK. The clients slots (`fe.transport.client`, `fe.package.api.client`) own their whole folder, so the API
 * layer decides WHERE a link may be and the folder called `links` is the one fact left to the rule; the manifest would
 * carry it as a role (`locale-link: links/locale.ts`) and this function would ask for that role instead.
 */
const linkFileName = (context) => {
  if (!isApiLayer(context)) return null
  const parts = hfsOf(context).relative(fileOf(context)).split("/")
  return parts.at(-2) === "links" ? parts.at(-1) : null
}

/**
 * The link file that owns the locale header.
 *
 * This is the ONE file allowed to write it: the `locale` link of a transport slot. The point of the second rule is that
 * the header appears in one place, so that place has to be named somewhere, and a name is what the law and the rule can
 * both refer to.
 */
const isLocaleLinkFile = (context) => {
  const name = linkFileName(context)
  return name !== null && stem(name) === "locale"
}

/**
 * One link's own implementation, rather than a chain of them.
 *
 * WHY THIS EXEMPTION EXISTS, AND IT WAS MEASURED. The first version of the chain rule keyed only on
 * "constructs the terminal link", which is true of the file that DEFINES that link - `links/http.ts`
 * builds `new HttpLink(...)`, because that is its whole job. Run against real source it reported
 * that file and its spec, and there was no correct way to satisfy it there: attaching a locale link
 * inside the http link would be a chain hiding in a link.
 *
 * A file under `links/` is one link. A chain is assembled somewhere else, which is exactly where the
 * locale belongs.
 */
const isLinkImplementationFile = (context) => linkFileName(context) !== null

/** The header a request declares its language in; HTTP header names are case-insensitive. */
export const LOCALE_HEADER = "Accept-Language"

/** The retired locale header is refused everywhere, including the locale link. */
const RETIRED_LOCALE_HEADER = ["x", "locale"].join("-")

/** Callee names that construct the terminal link - the one that actually reaches the network. */
const TERMINAL_LINK_CALLEES = new Set(["createHttpLink", "HttpLink", "createUploadLink", "BatchHttpLink"])

/** Callee names that attach the reader's locale to an operation. */
const LOCALE_LINK_CALLEES = new Set(["createAttachLocaleLink", "createLocaleLink"])

/** The callee name of a call or `new` expression, when it has a plain one. */
const calleeName = (node) => {
  const callee = node && node.callee
  if (!callee) return null
  if (callee.type === "Identifier") return callee.name
  if (callee.type === "MemberExpression" && callee.property && callee.property.type === "Identifier") {
    return callee.property.name
  }
  return null
}

/** Literal and expression-free template spellings identify the same header. */
const stringOf = (node) => {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked
  return null
}

/** Every static property spelling, without treating a computed variable as its identifier's name. */
const keyOf = (node) => node?.property?.type === "Identifier" && !node.computed ? node.property.name : stringOf(node?.property)

/** Every string-ish key a property can carry, so `"Accept-Language"` and `["Accept-Language"]` read the same. */
const propertyKeyOf = (property) => {
  if (!property || property.type !== "Property") return null
  const key = property.key
  if (!key) return null
  if (key.type === "Identifier" && !property.computed) return key.name
  return stringOf(key)
}

/** Resolve a receiver's binding, so an unrelated local `Headers` or `set` method stays unrelated. */
const variableOf = (node, sourceCode) => {
  for (let scope = sourceCode.getScope(node); scope; scope = scope.upper) {
    const variable = scope.set.get(node.name)
    if (variable) return variable
  }
  return null
}

/** Global browser constructors and globals may be qualified, but cannot be shadowed. */
const isNativeName = (node, name, sourceCode) => {
  if (node?.type === "Identifier") return node.name === name && !variableOf(node, sourceCode)?.defs.length
  return node?.type === "MemberExpression" && keyOf(node) === name &&
    ["globalThis", "window"].some((global) => isNativeName(node.object, global, sourceCode))
}

/** Syntax establishes native Headers values and stable aliases; unknown or reassigned receivers are left alone. */
const isNativeInstance = (node, name, sourceCode, seen = new Set()) => {
  if (!node || seen.has(node)) return false
  seen.add(node)
  const annotation = node.typeAnnotation?.typeAnnotation ?? node.typeAnnotation
  if (annotation?.type === "TSTypeReference" && isNativeName(annotation.typeName, name, sourceCode)) return true
  if (["TSAsExpression", "TSNonNullExpression", "ChainExpression"].includes(node.type)) return isNativeInstance(node.expression, name, sourceCode, seen)
  if (node.type === "NewExpression") return isNativeName(node.callee, name, sourceCode)
  if (name === "Headers" && node.type === "MemberExpression" && keyOf(node) === "headers") {
    return ["Request", "Response"].some((owner) => isNativeInstance(node.object, owner, sourceCode, new Set(seen)))
  }
  if (node.type !== "Identifier") return false
  const variable = variableOf(node, sourceCode)
  if (variable?.references.some((reference) => reference.isWrite() && !reference.init)) return false
  return (variable?.identifiers ?? []).some((identifier) => isNativeInstance(identifier, name, sourceCode, seen)) ||
    (variable?.defs ?? []).some((definition) => definition.type === "Variable" && isNativeInstance(definition.node.init, name, sourceCode, seen))
}

export const rules = {
  "api-client-attaches-the-locale": {
    meta: {
      type: "problem",
      docs: {
        description:
          "A transport chain that builds the terminal HTTP link must also attach the reader's locale, so every call declares the language it wants served.",
      },
      schema: [],
      messages: {
        missing:
          "This assembles the API transport but never attaches the reader's locale, so every call it makes is served the server's default language. Add the locale link to the chain, beside the auth link and unconditionally - a guest reads in a language too. A surface that is bilingual in its chrome and monolingual in its content reads as a translation gap, which is why it gets looked for in the dictionary rather than here.",
      },
    },
    create(context) {
      // A single link's implementation is not a chain - `links/http.ts` constructs the terminal link
      // because defining it IS its job, and there is no correct way to attach a locale there. A
      // spec asserts about a chain rather than being one.
      if (isLinkImplementationFile(context)) return {}
      let terminalNode = null
      let attachesLocale = false
      const note = (node) => {
        const name = calleeName(node)
        if (name === null) return
        if (TERMINAL_LINK_CALLEES.has(name)) terminalNode = terminalNode || node
        if (LOCALE_LINK_CALLEES.has(name)) attachesLocale = true
      }
      return {
        CallExpression: note,
        NewExpression: note,
        "Program:exit"() {
          if (terminalNode && !attachesLocale) {
            context.report({ node: terminalNode, messageId: "missing" })
          }
        },
      }
    },
  },

  "locale-header-belongs-to-the-link": {
    meta: {
      type: "problem",
      docs: {
        description:
          "The locale header is written by the locale link and nowhere else, so one place answers which language a request is in.",
      },
      schema: [],
      messages: {
        elsewhere:
          "Only the locale link may write `Accept-Language`. Setting it here is a second answer to which language this request is in, and the two diverge the first time one of them is updated - usually leaving a single hook correct and the rest of the surface on the server's default. Let the transport attach it.",
        retired:
          "The retired custom locale header must not be sent. Declare the reader's language with `Accept-Language` in the locale link, the one place that owns it.",
      },
    },
    create(context) {
      const ownsLocale = isLocaleLinkFile(context)
      const sourceCode = context.sourceCode ?? context.getSourceCode()
      const checkHeader = (node, key) => {
        const header = key?.toLowerCase()
        if (header === RETIRED_LOCALE_HEADER) {
          context.report({ node, messageId: "retired" })
        } else if (header === LOCALE_HEADER.toLowerCase() && !ownsLocale) {
          context.report({ node, messageId: "elsewhere" })
        }
      }
      return {
        Property(node) {
          checkHeader(node, propertyKeyOf(node))
        },
        AssignmentExpression(node) {
          if (node.left.type === "MemberExpression") checkHeader(node, keyOf(node.left))
        },
        NewExpression(node) {
          const initial = node.arguments[0]
          if (!isNativeName(node.callee, "Headers", sourceCode) || initial?.type !== "ArrayExpression") return
          for (const entry of initial.elements) {
            if (entry?.type === "ArrayExpression") checkHeader(entry, stringOf(entry.elements[0]))
          }
        },
        CallExpression(node) {
          const callee = node.callee
          if (callee.type === "MemberExpression" && ["set", "append"].includes(keyOf(callee)) && isNativeInstance(callee.object, "Headers", sourceCode)) {
            checkHeader(node, stringOf(node.arguments[0]))
          }
        },
      }
    },
  },
}

/** Every FE canon rule is an error; see `sources/fe/index.mjs` for why there is no warn tier. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
