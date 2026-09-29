"use client"

import { useState } from "react"
import type { SendInput } from "@/modules/api/sales"
import { OperatePageBase } from "./component"

/** Input of OperatePage: route params as atoms, plus whether the viewer may edit. */
export type OperatePageProps = {
    readonly handoffId: string
    readonly canEdit: boolean
}

/** Connected half: holds which send the overlay shows and picks the page shape. */
export const OperatePage = (props: OperatePageProps) => {
    const [sendInput, setSendInput] = useState<SendInput>()
    return (
        <OperatePageBase
            state={props.canEdit ? "edit" : "view"}
            props={{ handoffId: props.handoffId, sendInput }}
            on={{
                openSend: setSendInput,
                closeSend: () => setSendInput(undefined),
            }}
        />
    )
}
