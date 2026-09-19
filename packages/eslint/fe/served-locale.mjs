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
 * inside a function these rules only see the name of. A link that attaches `x-locale: "en"`
 * unconditionally satisfies both and is wrong. That case is a review question and LOCALE-2 is where
 * it is argued; pretending otherwise would be the rule claiming a guarantee it does not have.
 *
 * WHY THE FIRST RULE KEYS ON THE TERMINAL LINK RATHER THAN ON THE FILE PATH. A repository may name
 * its client folder anything, and a path pattern that guessed wrong would either miss the real chain
 * or fire on every helper beside it. The chain is identifiable by what it does: it builds the link
 * that talks to the network.
 *
 * WITH ONE EXEMPTION THAT WAS FOUND BY RUNNING IT, NOT BY THINKING ABOUT IT. "Constructs the
 * terminal link" is also true of the file that DEFINES that link, so the first version reported
 * `links/http.ts` and its spec on a repository that had done everything right. There was no correct
 * way to satisfy it there - a locale link inside the http link is a chain hiding in a link - and a
 * rule with no correct way to satisfy it is a finding about the rule. A file under `links/` is one
 * link; a chain is assembled elsewhere, which is where the locale belongs.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalize = (filename) => String(filename || "").replace(/\\/g, "/")

/**
 * The link file that owns the locale header.
 *
 * This is the ONE file allowed to write it, and it is recognised by path rather than by content:
 * the point of the second rule is that the header appears in one place, so that place has to be
 * named somewhere, and a name is what the law and the rule can both refer to.
 */
export const isLocaleLinkFile = (filename) => /\/links\/locale\.[cm]?tsx?$/.test(normalize(filename))

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
export const isLinkImplementationFile = (filename) => /\/links\/[^/]+$/.test(normalize(filename))

/** A spec or test file - it asserts about production shapes rather than being one. */
export const isTestFile = (filename) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(normalize(filename))

/** The header a request declares its language in. */
export const LOCALE_HEADER = "x-locale"

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

/** Every string-ish key a property can carry, so `"x-locale"` and `["x-locale"]` read the same. */
const propertyKeyOf = (property) => {
  if (!property || property.type !== "Property") return null
  const key = property.key
  if (!key) return null
  if (key.type === "Identifier" && !property.computed) return key.name
  if (key.type === "Literal" && typeof key.value === "string") return key.value
  return null
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
      const filename = context.filename || context.getFilename()
      // A single link's implementation is not a chain - `links/http.ts` constructs the terminal link
      // because defining it IS its job, and there is no correct way to attach a locale there. A
      // spec asserts about a chain rather than being one.
      if (isLinkImplementationFile(filename) || isTestFile(filename)) return {}
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
          "Only the locale link may write `x-locale`. Setting it here is a second answer to which language this request is in, and the two diverge the first time one of them is updated - usually leaving a single hook correct and the rest of the surface on the server's default. Let the transport attach it.",
      },
    },
    create(context) {
      const filename = context.filename || context.getFilename()
      if (isLocaleLinkFile(filename)) return {}
      return {
        Property(node) {
          if (propertyKeyOf(node) === LOCALE_HEADER) {
            context.report({ node, messageId: "elsewhere" })
          }
        },
      }
    },
  },
}

/** Every FE canon rule is an error; see `sources/fe/index.mjs` for why there is no warn tier. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
