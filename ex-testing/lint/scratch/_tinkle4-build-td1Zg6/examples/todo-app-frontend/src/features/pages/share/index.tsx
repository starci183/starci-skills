"use client"

import { GrammarRoot } from "@starci/grammar/common"
import { ShareInviteBlock } from "@/components/blocks/share-invite"

/** The public props of the share feature entry: only the task the route resolved. */
export type SharePageProps = {
  readonly taskId: string;
};

/**
 * The share feature's public entry and client boundary: Grammar's scope begins here, the
 * ShareInviteBlock owns every hook and mutation, and the route adapter only hands the taskId
 * through.
 */
export const SharePage = (props: SharePageProps) => (
    <GrammarRoot>
        <ShareInviteBlock taskId={props.taskId} />
    </GrammarRoot>
)
