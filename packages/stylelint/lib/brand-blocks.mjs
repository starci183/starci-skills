/**
 * The blocks of a brand layer, read the way `starci/brand-layer-shape` accepts them: each top-level rule whose
 * selectors are all light or dark scopes (a compound `:root, .light, .dark` names both), and each rule of the
 * `@media (prefers-color-scheme: dark)` block. A block that is not one of those is left out: the shape rule reports it.
 */
import { isAlwaysSelector, isDarkMedia, isSystemSelector, themeOfSelector } from "./scope.mjs"

/**
 * @returns {{ node: import("postcss").Rule, themes: Set<"light" | "dark">, always: boolean }[]} in source order.
 *   `always` is true when a selector of the block matches the root whatever the theme is (`:root`, `html`), so the dark
 *   theme inherits its tokens too.
 */
export function readBrandBlocks(root) {
  const blocks = []
  root.each((node) => {
    if (node.type === "rule") {
      const themes = node.selectors.map((selector) => themeOfSelector(selector))
      if (themes.includes(null)) return
      blocks.push({ node, themes: new Set(themes), always: node.selectors.some(isAlwaysSelector) })
    } else if (node.type === "atrule" && node.name.toLowerCase() === "media" && isDarkMedia(node.params)) {
      node.each((child) => {
        if (child.type === "rule" && child.selectors.every(isSystemSelector)) blocks.push({ node: child, themes: new Set(["dark"]), always: false })
      })
    }
  })
  return blocks
}

/**
 * The declarations of the brand layer for one theme, in cascade order: the blocks that name the theme, and (for the
 * dark theme) the blocks that match the root in every theme, since `html.dark` matches `:root` as well.
 * @returns {Map<string, import("postcss").Declaration>} custom property to the declaration that wins.
 */
export function declarationsFor(blocks, theme) {
  const winning = new Map()
  for (const block of blocks) {
    if (!block.themes.has(theme) && !(theme === "dark" && block.always)) continue
    block.node.each((child) => {
      if (child.type === "decl" && child.prop.startsWith("--")) winning.set(child.prop, child)
    })
  }
  return winning
}

/** The custom properties a theme declares itself (not through `:root` inheritance): what "has a value in this theme" means. */
export function declaredIn(blocks, theme) {
  const names = new Set()
  for (const block of blocks) {
    if (!block.themes.has(theme)) continue
    block.node.each((child) => {
      if (child.type === "decl" && child.prop.startsWith("--")) names.add(child.prop)
    })
  }
  return names
}
