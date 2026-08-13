/**
 * The rule that holds `vendor-boundary.md`.
 *
 * IT IS CHECKED IN BOTH DIRECTIONS, and the second direction is the whole reason this is a policy
 * rather than a hole. Outward, a component that imports the library from the wrong folder is
 * misfiled - that half is obvious. Inward, a file sitting in a wrapper folder that imports nothing
 * is an ordinary component holding an exemption it does not need, and without that check the folder
 * becomes the place difficult things go. The first thing to opt in is always something that was
 * hard to place.
 *
 * THE GLYPH LIBRARY IS SOMEBODY ELSE'S RULE, deliberately. `icon.mjs` owns it, because a rule that
 * names one vendor protects one vendor - and the gap between two such rules is where a caret came
 * to be imported straight from a glyph package at a size that existed nowhere else, reported by
 * nothing.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** Dot form of a two-part JSX member name such as `Checkbox.Content`. */
const memberName = (node) => {
  if (node?.type !== "JSXMemberExpression") return null
  if (node.object?.type !== "JSXIdentifier" || node.property?.type !== "JSXIdentifier") return null
  return `${node.object.name}.${node.property.name}`
}

/** The component library this boundary owns. Its glyph counterpart belongs to `icon.mjs`. */
const VENDOR_PACKAGE_PREFIX = "@heroui/"

/** The shell folder is closed to the three vendor mechanics that intentionally ignore their interior. */
const SHELL_DIR = "/src/components/shells/"
const SHELL_FILE = /\/src\/components\/shells\/(?:ModalShell|DrawerShell|DropdownShell)\//

/** Named surface branches may own the vendor wrapper they project a content contract into. */
const SURFACE_BRANCH = /\/src\/components\/branches\/(?:SurfaceCard|SurfaceAccordionCard|SurfaceListCard|SurfaceFormCard)\//

const isAllowedVendorOwner = (file) =>
  file.includes("/src/components/leaves/") || SHELL_FILE.test(file) || SURFACE_BRANCH.test(file)

/** True for a file inside the component tree, where the boundary applies. */
const isComponentFile = (filename) => normalizePath(filename).includes("/src/components/")

/** True when an import names the component library, subpaths included. */
const isVendorImport = (source) => typeof source === "string" && source.startsWith(VENDOR_PACKAGE_PREFIX)

/** Read a two-part JSX member such as `Modal.Body`. */
const jsxMemberName = (node) => {
  if (node?.type !== "JSXMemberExpression") return null
  if (node.object?.type !== "JSXIdentifier" || node.property?.type !== "JSXIdentifier") return null
  return `${node.object.name}.${node.property.name}`
}

// -- VENDOR-1 · VENDOR-2 ---------------------------------------------------------------------------

/** The library belongs to two folders, and a wrapper folder that wraps nothing is misfiled. */
export const vendorBoundary = {
  meta: {
    type: "problem",
    docs: { description: "Vendor imports belong to leaves, the two covering shells, and named surface branches." },
    schema: [],
    messages: {
      outside:
        "This component does not own a vendor primitive. Vendor imports belong to leaves, ModalShell/DrawerShell, and the named SurfaceCard family branches that project contracts into vendor bodies.",
      emptyShell:
        "ModalShell/DrawerShell must wrap their vendor covering primitive; otherwise this is an ordinary branch in the wrong tier.",
      unknownShell:
        "Only ModalShell and DrawerShell are shells. This component must use contract + render as a branch; needing an arbitrary vendor children slot does not create a third shell.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    // Outside the component tree, a provider standing the library up for the whole application is a
    // different thing from a component pulling in a widget.
    if (!isComponentFile(file)) return {}
    const isShellDirectory = file.includes(SHELL_DIR)
    const isShell = SHELL_FILE.test(file)
    const isAllowed = isAllowedVendorOwner(file)
    let importsVendor = false
    return {
      ImportDeclaration(node) {
        if (!isVendorImport(node.source && node.source.value)) return
        importsVendor = true
        if (isAllowed) return
        context.report({ node, messageId: "outside" })
      },
      "Program:exit"(node) {
        if (isShellDirectory && !isShell) context.report({ node, messageId: "unknownShell" })
        else if (isShell && !importsVendor) context.report({ node, messageId: "emptyShell" })
      },
    }
  },
}

// -- VENDOR-6 --------------------------------------------------------------------------------------

/** A content-agnostic modal shell owns one zero-inset vendor body as the scroll region. */
export const modalShellOwnsScrollBody = {
  meta: {
    type: "problem",
    docs: { description: "ModalShell keeps one zero-inset Modal.Body as its scroll region." },
    schema: [],
    messages: {
      missing:
        "ModalShell must keep one `Modal.Body` around its uninterpreted children: that vendor body is the dialog's scroll region, not a second content surface.",
      inset:
        "ModalShell's body must be `className=\"p-0\"`. The mounted contract owns layout; vendor body padding plus contract padding creates a doubled inset.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!/\/src\/components\/shells\/ModalShell\/index\.tsx$/.test(file)) return {}
    let hasBody = false
    return {
      JSXOpeningElement(node) {
        if (jsxMemberName(node.name) !== "Modal.Body") return
        hasBody = true
        const className = (node.attributes || []).find((attribute) =>
          attribute.type === "JSXAttribute"
          && attribute.name?.type === "JSXIdentifier"
          && attribute.name.name === "className")
        if (className?.value?.type === "Literal" && className.value.value === "p-0") return
        context.report({ node, messageId: "inset" })
      },
      "Program:exit"(node) {
        if (!hasBody) context.report({ node, messageId: "missing" })
      },
    }
  },
}

// -- VENDOR-7 --------------------------------------------------------------------------------------

/** The house Field fixes the vendor input variant used on bounded form surfaces. */
export const fieldInputUsesSecondaryVariant = {
  meta: {
    type: "problem",
    docs: { description: "The Field leaf uses HeroUI Input's secondary surface variant." },
    schema: [],
    messages: {
      variant:
        "The house Field sits inside a bounded form surface. Its HeroUI Input must use `variant=\"secondary\"`; the default variant draws a competing field surface.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!/\/src\/components\/leaves\/Field\/index\.tsx$/.test(file)) return {}
    const inputBindings = new Set()
    return {
      ImportDeclaration(node) {
        if (node.source?.value !== "@heroui/react") return
        for (const specifier of node.specifiers || []) {
          if (specifier.imported?.name === "Input" && specifier.local?.name) inputBindings.add(specifier.local.name)
        }
      },
      JSXOpeningElement(node) {
        const name = node.name?.type === "JSXIdentifier" ? node.name.name : null
        if (!name || !inputBindings.has(name)) return
        const variant = (node.attributes || []).find((attribute) =>
          attribute.type === "JSXAttribute"
          && attribute.name?.type === "JSXIdentifier"
          && attribute.name.name === "variant")
        if (variant?.value?.type === "Literal" && variant.value.value === "secondary") return
        context.report({ node, messageId: "variant" })
      },
    }
  },
}

// -- VENDOR-9 --------------------------------------------------------------------------------------

/** Field labels stay textual instead of inferring decorative glyphs from the input kind. */
export const fieldLabelIsTextOnly = {
  meta: {
    type: "problem",
    docs: { description: "The house Field label contains no inferred kind icon." },
    schema: [],
    messages: {
      icon:
        "Field labels are text-only in the source design. Do not infer a decorative icon from the input kind; an icon belongs only to a control with its own action, such as password visibility.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!/\/src\/components\/leaves\/Field\/index\.tsx$/.test(file)) return {}
    const iconBindings = new Set()
    return {
      ImportDeclaration(node) {
        const source = normalizePath(node.source?.value)
        if (!/\/components\/leaves\/Icon$/.test(source)) return
        for (const specifier of node.specifiers || []) {
          if (specifier.imported?.name === "Icon" && specifier.local?.name) iconBindings.add(specifier.local.name)
        }
      },
      JSXOpeningElement(node) {
        const name = node.name?.type === "JSXIdentifier" ? node.name.name : null
        if (!name || !iconBindings.has(name)) return
        let ancestor = node.parent
        while (ancestor) {
          if (
            ancestor.type === "JSXElement"
            && ancestor.openingElement?.name?.type === "JSXIdentifier"
            && ancestor.openingElement.name.name === "label"
          ) {
            context.report({ node, messageId: "icon" })
            return
          }
          ancestor = ancestor.parent
        }
      },
    }
  },
}

// -- VENDOR-8 --------------------------------------------------------------------------------------

/** An overlay is already bounded and cannot directly mount a second named surface branch. */
export const noSurfaceBranchInOverlay = {
  meta: {
    type: "problem",
    docs: { description: "An overlay does not directly mount a named surface branch." },
    schema: [],
    messages: {
      nested:
        "This overlay is already the bounded surface. Do not mount `{{surface}}` inside it; use headings, spacing, rows and controls directly.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!file.includes("/src/components/overlays/")) return {}
    return {
      ImportDeclaration(node) {
        const source = normalizePath(node.source?.value)
        const match = source.match(/\/components\/branches\/(SurfaceCard|SurfaceAccordionCard|SurfaceListCard|SurfaceFormCard)$/)
        if (match) context.report({ node, messageId: "nested", data: { surface: match[1] } })
      },
    }
  },
}

// -- VENDOR-10 -------------------------------------------------------------------------------------

/** TextLink delegates link interaction and hover treatment to HeroUI Link. */
export const textLinkUsesHeroLink = {
  meta: {
    type: "problem",
    docs: { description: "TextLink wraps HeroUI Link instead of hand-drawing link behavior." },
    schema: [],
    messages: {
      missing: "TextLink must import HeroUI `Link`. The vendor owns link hover, focus and interaction states.",
      handmade: "Do not rebuild a HeroUI Link with a raw button or local className. Wrap HeroUI `Link` and pass `onPress`.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!/\/src\/components\/leaves\/TextLink\/index\.tsx$/.test(file)) return {}
    let hasHeroLink = false
    return {
      ImportDeclaration(node) {
        if (node.source?.value !== "@heroui/react") return
        hasHeroLink ||= (node.specifiers || []).some((specifier) => specifier.imported?.name === "Link")
      },
      JSXOpeningElement(node) {
        if (node.name?.type === "JSXIdentifier" && node.name.name === "button") context.report({ node, messageId: "handmade" })
        const className = (node.attributes || []).find(
          (attribute) => attribute.type === "JSXAttribute" && attribute.name?.name === "className",
        )
        const classText = className?.value?.type === "Literal" ? String(className.value.value || "") : ""
        if (/(?:hover:|underline)/.test(classText)) {
          context.report({ node: className, messageId: "handmade" })
        }
      },
      "Program:exit"(node) {
        if (!hasHeroLink) context.report({ node, messageId: "missing" })
      },
    }
  },
}

// -- VENDOR-11 -------------------------------------------------------------------------------------

/** The account block owns the product choices; DropdownShell alone owns HeroUI mechanics. */
export const accountControlOwnsDropdown = {
  meta: {
    type: "problem",
    docs: { description: "AccountMenu is a block over DropdownShell; only the shell imports HeroUI Dropdown." },
    schema: [],
    messages: {
      dropdown: "DropdownShell must import HeroUI `Dropdown`; vendor mechanics belong to the shell.",
      shell: "AccountMenu's pure block half must compose DropdownShell instead of importing HeroUI directly.",
      vendor: "AccountMenu is a product block. Import DropdownShell; do not own HeroUI Dropdown here.",
      menu: "ShellNav must render the AccountMenu block from `components/blocks/auth/AccountMenu`.",
      direct: "The account IconButton may not carry an action in ShellNav. Guests open AccountMenu; its Sign in or Sign up choice opens the modal.",
      pieces: "AccountMenu passes typed section data to DropdownShell; it must not import shell Section or Item pieces and rebuild vendor anatomy itself.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    const isDropdown = /\/src\/components\/shells\/DropdownShell\/index\.tsx$/.test(file)
    const isMenu = /\/src\/components\/blocks\/auth\/AccountMenu\/component\.tsx$/.test(file)
    const isNav = /\/src\/components\/layouts\/ShellNav\/component\.tsx$/.test(file)
    if (!isDropdown && !isMenu && !isNav) return {}
    let hasOwner = false
    return {
      ExportNamedDeclaration(node) {
        if (!isDropdown) return
        const source = context.sourceCode || context.getSourceCode()
        if (/\bDropdownShell(?:Item|Section)\b/.test(source.getText(node))) {
          context.report({ node, messageId: "pieces" })
        }
      },
      ImportDeclaration(node) {
        if (isDropdown && node.source?.value === "@heroui/react") {
          hasOwner ||= (node.specifiers || []).some((specifier) => specifier.imported?.name === "Dropdown")
        }
        if (isMenu && node.source?.value === "@heroui/react") context.report({ node, messageId: "vendor" })
        if (isMenu && /\/components\/shells\/DropdownShell$/.test(normalizePath(node.source?.value))) {
          hasOwner = true
          if ((node.specifiers || []).some((specifier) =>
            /^(?:DropdownShellSection|DropdownShellItem)/.test(specifier.imported?.name || ""))) {
            context.report({ node, messageId: "pieces" })
          }
        }
        if (isNav && /\/components\/blocks\/auth\/AccountMenu$/.test(normalizePath(node.source?.value))) hasOwner = true
      },
      JSXOpeningElement(node) {
        if (!isNav || node.name?.type !== "JSXIdentifier" || node.name.name !== "IconButton") return
        const props = (node.attributes || []).find((attribute) => attribute.type === "JSXAttribute" && attribute.name?.name === "props")
        const expression = props?.value?.type === "JSXExpressionContainer" ? props.value.expression : null
        const isAccount = expression?.type === "ObjectExpression" && expression.properties.some((property) =>
          property.type === "Property" && property.key?.name === "icon" && property.value?.value === "account")
        const hasAction = (node.attributes || []).some((attribute) => attribute.type === "JSXAttribute" && attribute.name?.name === "on")
        if (isAccount && hasAction) context.report({ node, messageId: "direct" })
      },
      "Program:exit"(node) {
        if (hasOwner) return
        context.report({ node, messageId: isDropdown ? "dropdown" : isMenu ? "shell" : "menu" })
      },
    }
  },
}

// -- VENDOR-13 -------------------------------------------------------------------------------------

/** Checkbox.Content owns the control, indicator and label so every visible word toggles it. */
export const checkboxKeepsCompoundAnatomy = {
  meta: {
    type: "problem",
    docs: { description: "Keep the required HeroUI Checkbox nesting inside the house leaf." },
    schema: [],
    messages: {
      anatomy:
        "Checkbox must nest `HeroCheckbox.Control` (and its Indicator) inside `HeroCheckbox.Content`. Sibling Control and Content leave the visible label outside the checkbox's press target.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!/\/src\/components\/leaves\/Checkbox\/index\.tsx$/.test(file)) return {}
    let hasContent = false
    let controlInsideContent = false
    let indicatorInsideControl = false
    const hasAncestor = (node, expected) => {
      let ancestor = node.parent
      while (ancestor) {
        if (ancestor.type === "JSXElement" && memberName(ancestor.openingElement?.name) === expected) return true
        ancestor = ancestor.parent
      }
      return false
    }
    return {
      JSXOpeningElement(node) {
        const name = memberName(node.name)
        if (name === "HeroCheckbox.Content") hasContent = true
        if (name === "HeroCheckbox.Control" && hasAncestor(node, "HeroCheckbox.Content")) controlInsideContent = true
        if (name === "HeroCheckbox.Indicator" && hasAncestor(node, "HeroCheckbox.Control")) indicatorInsideControl = true
      },
      "Program:exit"(node) {
        if (!hasContent || !controlInsideContent || !indicatorInsideControl) {
          context.report({ node, messageId: "anatomy" })
        }
      },
    }
  },
}

// -- VENDOR-14 -------------------------------------------------------------------------------------

/** Internal StarCi navigation is an action resolved by connected code, never an href. */
export const noInternalStarciHref = {
  meta: {
    type: "problem",
    docs: { description: "Route internal StarCi destinations through connected router.push actions." },
    schema: [],
    messages: {
      internal:
        "Internal StarCi navigation must not use `href`. Keep the destination in connected code, report an id/press from the pure component, and call `router.push` there.",
      leaf:
        "This internal-navigation leaf must not declare or render `href`; it reports `on.press` and leaves routing to its connected owner.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!file.includes("/src/") || /\.(?:test|spec)\.[jt]sx?$/.test(file)) return {}
    const internalOnlyLeaf = /\/src\/components\/leaves\/(?:Checkbox|NavLink|QuickActionRow|SeeMoreLink)\/index\.tsx$/.test(file)
    const literalText = (node) => {
      if (node?.type === "Literal" && typeof node.value === "string") return node.value
      if (node?.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0]?.value?.cooked || ""
      return null
    }
    const isInternal = (value) => value.startsWith("/") || /^https?:\/\/(?:www\.)?academy\.starci\.org(?:\/|$)/i.test(value)
    return {
      JSXAttribute(node) {
        if (node.name?.name !== "href") return
        if (internalOnlyLeaf) {
          context.report({ node, messageId: "leaf" })
          return
        }
        const value = node.value?.type === "JSXExpressionContainer" ? literalText(node.value.expression) : literalText(node.value)
        if (value !== null && isInternal(value)) context.report({ node, messageId: "internal" })
      },
      Property(node) {
        const key = node.key?.type === "Literal" ? node.key.value : node.key?.name
        const value = literalText(node.value)
        if ((key === "href" || key === "externalHref") && value !== null && isInternal(value)) {
          context.report({ node, messageId: "internal" })
        }
      },
      TSPropertySignature(node) {
        if (!internalOnlyLeaf || node.key?.name !== "href") return
        context.report({ node, messageId: "leaf" })
      },
    }
  },
}

// -- VENDOR-12 -------------------------------------------------------------------------------------

/** The auth overlay projects one already-owned column and adds no vertical inset of its own. */
export const authOverlayOwnsSingleContentHost = {
  meta: {
    type: "problem",
    docs: { description: "Authentication has one zero-inset content host inside ModalShell." },
    schema: [],
    messages: {
      duplicate: "SignInOverlay must project with `ContractContent`, not open another `Tree` around a panel that already owns the same host.",
      missing: "SignInOverlay must import `ContractContent` for its already-hosted projection.",
      inset: "`centred-page-column` must not add py/pt/pb. ModalShell is zero-inset and the auth content touches that scroll region without a second vertical padding band.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    const isOverlay = /\/src\/components\/overlays\/auth\/SignInOverlay\/component\.tsx$/.test(file)
    const isContracts = /\/src\/components\/contracts\/index\.ts$/.test(file)
    if (!isOverlay && !isContracts) return {}
    let hasContent = false
    return {
      ImportDeclaration(node) {
        if (!isOverlay) return
        /*
         * Matched by the NAME imported, not by where it came from.
         *
         * The path test this replaced only recognised `components/branches/Tree`,
         * which is the single-app layout. A workspace that publishes the same
         * branches from a package satisfied the law and failed the rule, with
         * the only available remedy being an import of a module that does not
         * exist there. `ContractContent` and `Tree` are canon vocabulary: a file
         * importing either means the same thing wherever it resolves from.
         */
        for (const specifier of node.specifiers || []) {
          if (specifier.imported?.name === "ContractContent") hasContent = true
          if (specifier.imported?.name === "Tree") context.report({ node: specifier, messageId: "duplicate" })
        }
      },
      Property(node) {
        if (!isContracts) return
        const key = node.key?.type === "Literal" ? node.key.value : node.key?.name
        if (key !== "centred-page-column") return
        const source = context.sourceCode || context.getSourceCode()
        if (/["'`](?:py|pt|pb)-/.test(source.getText(node))) context.report({ node, messageId: "inset" })
      },
      "Program:exit"(node) {
        if (isOverlay && !hasContent) context.report({ node, messageId: "missing" })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "vendor-boundary": vendorBoundary,
  "modal-shell-owns-scroll-body": modalShellOwnsScrollBody,
  "field-input-uses-secondary-variant": fieldInputUsesSecondaryVariant,
  "field-label-is-text-only": fieldLabelIsTextOnly,
  "no-surface-branch-in-overlay": noSurfaceBranchInOverlay,
  "text-link-uses-hero-link": textLinkUsesHeroLink,
  "account-control-owns-dropdown": accountControlOwnsDropdown,
  "auth-overlay-owns-single-content-host": authOverlayOwnsSingleContentHost,
  "checkbox-keeps-compound-anatomy": checkboxKeepsCompoundAnatomy,
  "no-internal-starci-href": noInternalStarciHref,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * A repository adopting this with history should expect the outward half to report and the inward
 * half to be silent, because `shells/` will not exist yet. Creating it is the migration: every
 * vendor container currently wrapped as something else moves there, and each move is what makes the
 * inward check meaningful afterwards.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
