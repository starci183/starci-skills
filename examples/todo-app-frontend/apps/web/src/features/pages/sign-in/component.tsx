import { GrammarRoot } from "@starci/grammar/common"
import { SignInFormBlock } from "@/components/blocks/sign-in-form"
import { Heading } from "@/components/leaves/Heading"

type SignInPageBaseProps = { readonly title: string }

/** Draw the translated sign-in heading above its connected form. */
export const SignInPageBase = ({ title }: SignInPageBaseProps) => (
    <GrammarRoot>
        <main>
            <Heading level={1}>{title}</Heading>
            <SignInFormBlock />
        </main>
    </GrammarRoot>
)
