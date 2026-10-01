import { Button, Heading, SurfaceCard, Text } from "@starci/grammar/common"
import { END_CONFIRM_CLASS_NAME, FORM_ACTIONS_CLASS_NAME, SUMMARY_STACK_CLASS_NAME } from "./classNames"

/** Every word the created rule's summary card renders, resolved by the connected half. */
type RuleSummaryCopy = {
    readonly scheduleCard: string
    /** The one sentence that names the rule: its frequency phrase inside the fixed frame. */
    readonly summary: string
    readonly endRule: string
    readonly ending: string
    readonly keepRule: string
    readonly endConfirm: string
}

/** The summary card's contract: the words, the refusal in flight, whether the rule may still be ended and every intent. */
export type RuleSummaryProps = {
    readonly copy: RuleSummaryCopy
    readonly refusal: string | null
    /** The rule is still active, so the end action is offered. */
    readonly isActive: boolean
    readonly isConfirmingEnd: boolean
    readonly isEnding: boolean
    readonly onEndRule: () => void
    readonly onConfirmEndRule: () => void
    readonly onCancelEndRule: () => void
}

/**
 * fr.recur.end-rule's consequence confirmation, kept inline where the button was so focus stays in
 * place when it is dismissed: ending a rule stops future occurrences and keeps materialised history
 * (outstanding materialised occurrences become orphaned).
 */
export const RuleSummary = (props: RuleSummaryProps) => {
    const copy = props.copy
    return (
        <SurfaceCard ariaLabel={copy.scheduleCard}>
            <div className={SUMMARY_STACK_CLASS_NAME}>
                <Heading level={2}>{copy.scheduleCard}</Heading>
                <Text>{copy.summary}</Text>
                {props.refusal === null ? null : <Text live="assertive">{props.refusal}</Text>}
                {props.isActive && props.isConfirmingEnd ? (
                    <div className={END_CONFIRM_CLASS_NAME}>
                        <Text>{copy.endConfirm}</Text>
                        <div className={FORM_ACTIONS_CLASS_NAME}>
                            <Button
                                type="button"
                                variant="danger"
                                isDisabled={props.isEnding}
                                isPending={props.isEnding}
                                onPress={props.onConfirmEndRule}
                            >
                                {props.isEnding ? copy.ending : copy.endRule}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                isDisabled={props.isEnding}
                                onPress={props.onCancelEndRule}
                            >
                                {copy.keepRule}
                            </Button>
                        </div>
                    </div>
                ) : null}
                {props.isActive && !props.isConfirmingEnd ? (
                    <Button type="button" variant="outline" onPress={props.onEndRule}>
                        {copy.endRule}
                    </Button>
                ) : null}
            </div>
        </SurfaceCard>
    )
}
