import type { useTranslations } from "next-intl"
import { Button, Text } from "@starci/grammar/common"
import { END_CONFIRM_CLASS_NAME, FORM_ACTIONS_CLASS_NAME } from "./classNames"

/**
 * fr.recur.end-rule's consequence confirmation, kept inline where the button was so focus stays in
 * place when it is dismissed: ending a rule stops future occurrences and keeps materialised history
 * (outstanding materialised occurrences become orphaned). There is no danger Button variant in this
 * Grammar version - a declared gap on ui.recur.schedule - so the confirm action keeps the same
 * outline treatment as the button it replaces and the consequence is carried by the sentence.
 */
export type EndRuleConfirmProps = {
  readonly isEnding: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

type EndRuleConfirmBaseProps = EndRuleConfirmProps & { readonly t: ReturnType<typeof useTranslations<"recur">> }

/** Draw the inline consequence without reading locale state. */
export const EndRuleConfirmBase = (props: EndRuleConfirmBaseProps) => (
    <div className={END_CONFIRM_CLASS_NAME}>
        <Text>{props.t("endConfirm")}</Text>
        <div className={FORM_ACTIONS_CLASS_NAME}>
            <Button type="button" variant="outline" isDisabled={props.isEnding} isPending={props.isEnding} onPress={props.onConfirm}>
                {props.isEnding ? props.t("ending") : props.t("endRule")}
            </Button>
            <Button type="button" variant="ghost" isDisabled={props.isEnding} onPress={props.onCancel}>
                {props.t("keepRule")}
            </Button>
        </div>
    </div>
)
