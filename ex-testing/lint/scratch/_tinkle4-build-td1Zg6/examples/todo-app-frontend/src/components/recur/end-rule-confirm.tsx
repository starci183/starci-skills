import { useTranslations } from "next-intl"
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

/** The inline confirm region shown in place of the End rule button. */
export const EndRuleConfirm = (props: EndRuleConfirmProps) => {
    const t = useTranslations("recur")
    return (
        <div className={END_CONFIRM_CLASS_NAME}>
            <Text>{t("endConfirm")}</Text>
            <div className={FORM_ACTIONS_CLASS_NAME}>
                <Button type="button" variant="outline" isDisabled={props.isEnding} isPending={props.isEnding} onPress={props.onConfirm}>
                    {props.isEnding ? t("ending") : t("endRule")}
                </Button>
                <Button type="button" variant="ghost" isDisabled={props.isEnding} onPress={props.onCancel}>
                    {t("keepRule")}
                </Button>
            </div>
        </div>
    )
}
