import { Button, List, ListItem } from "@starci/grammar/common"
import { moduleHref } from "@/modules/routes"

/** Props for ModuleNavBlock. */
type ModuleNavBlockProps = {
    readonly workspaceId: string
    readonly active: string
    /** An atom, not a shape: the list keeps its layout, only the label length changes. */
    readonly density: "full" | "icon"
}

const modules = ["sales-copilot", "accounting", "chatbot"]

/** Pure block with one shape and no api: no connected twin is needed. */
export const ModuleNavBlock = (props: ModuleNavBlockProps) => (
    <List>
        {modules.map((name) => (
            <ListItem key={name}>
                <Button
                    variant={name === props.active ? "secondary" : "ghost"}
                    href={moduleHref(props.workspaceId, name)}
                >
                    {props.density === "full" ? name : name.slice(0, 1).toUpperCase()}
                </Button>
            </ListItem>
        ))}
    </List>
)
