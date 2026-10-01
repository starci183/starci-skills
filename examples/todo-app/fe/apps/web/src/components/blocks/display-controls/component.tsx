import { SegmentedControl } from "@starci/grammar/common"
import { DISPLAY_CONTROLS_CLASS_NAME } from "./classNames"

/** The two copy groups of the controls, resolved by the connected half. */
export type DisplayControlsCopy = {
    readonly theme: {
        readonly label: string
        readonly light: string
        readonly dark: string
        readonly system: string
    }
    readonly locale: {
        readonly label: string
        readonly en: string
        readonly vi: string
    }
}

/** The pure renderer's complete input: the current choices, the words and the two changes the reader can make. */
export type DisplayControlsViewProps = {
    readonly theme: string
    readonly locale: string
    readonly copy: DisplayControlsCopy
    readonly onThemeChange: (value: string) => void
    readonly onLocaleChange: (value: string) => void
}

/** The theme choice and the language choice, each drawn as joined segments. Pure: no hooks, no world state. */
export const DisplayControlsView = (props: DisplayControlsViewProps) => (
    <div className={DISPLAY_CONTROLS_CLASS_NAME}>
        <SegmentedControl
            label={props.copy.theme.label}
            isLabelHidden
            options={[
                { value: "light", label: props.copy.theme.light },
                { value: "dark", label: props.copy.theme.dark },
                { value: "system", label: props.copy.theme.system },
            ]}
            value={props.theme}
            onValueChange={props.onThemeChange}
        />
        <SegmentedControl
            label={props.copy.locale.label}
            isLabelHidden
            options={[
                { value: "en", label: props.copy.locale.en },
                { value: "vi", label: props.copy.locale.vi },
            ]}
            value={props.locale}
            onValueChange={props.onLocaleChange}
        />
    </div>
)
