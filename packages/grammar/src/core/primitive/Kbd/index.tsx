import { Kbd as HeroKbd } from "@heroui/react"

/** Named keys drawn as their platform symbol, with the spelled-out name as the abbreviation title. */
export const KBD_NAMED_KEYS = [
    "command", "shift", "ctrl", "option", "enter", "delete", "escape", "tab", "capslock", "up", "right",
    "down", "left", "pageup", "pagedown", "home", "end", "help", "space", "fn", "win", "alt",
] as const

export type KbdNamedKey = (typeof KBD_NAMED_KEYS)[number]

export type KbdProps = {
    /**
     * The chord, in press order. A named key (`command`, `shift`, `enter`...) renders its symbol inside
     * an `<abbr>` whose title spells the key; any other string (`K`, `F6`) renders verbatim.
     */
    readonly keys: readonly string[]
}

const namedKeys: ReadonlySet<string> = new Set(KBD_NAMED_KEYS)
const isNamedKey = (key: string): key is KbdNamedKey => namedKeys.has(key)

/** ATOM - `Kbd`: one keyboard shortcut chord as a single `<kbd>` element. Contract: ICON-6 (key glyphs named once via `<abbr title>`). */
export const Kbd = ({ keys }: KbdProps) => (
    <HeroKbd data-tier="atom" data-component="Kbd" data-contract="ICON-6" className="starci-core-kbd">
        {keys.map((key, index) => isNamedKey(key)
            ? <HeroKbd.Abbr key={`${key}-${index}`} keyValue={key} />
            : <HeroKbd.Content key={`${key}-${index}`}>{key}</HeroKbd.Content>)}
    </HeroKbd>
)
