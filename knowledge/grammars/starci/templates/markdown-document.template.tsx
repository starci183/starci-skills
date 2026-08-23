/**
 * Durable authored-document template.
 *
 * This is intentionally product- and parser-agnostic. A project profile supplies the concrete
 * parser, router link, code, table, media and extension owners; the document owner preserves the
 * semantic outline and keeps every wide block inside its own overflow plane.
 */
type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6
type LinkDisposition = "same-document" | "internal" | "external" | "blocked"

type InlineNode =
    | { readonly kind: "text"; readonly value: string }
    | { readonly kind: "strong" | "emphasis"; readonly parts: ReadonlyArray<InlineNode> }
    | { readonly kind: "code"; readonly value: string }
    | { readonly kind: "link"; readonly destination: string; readonly parts: ReadonlyArray<InlineNode> }
    | { readonly kind: "break" }

type BlockNode =
    | { readonly id: string; readonly kind: "heading"; readonly authoredDepth: HeadingLevel; readonly parts: ReadonlyArray<InlineNode> }
    | { readonly id: string; readonly kind: "paragraph"; readonly parts: ReadonlyArray<InlineNode> }
    | { readonly id: string; readonly kind: "list"; readonly ordered: boolean; readonly items: ReadonlyArray<ReadonlyArray<BlockNode>> }
    | { readonly id: string; readonly kind: "quote"; readonly blocks: ReadonlyArray<BlockNode> }
    | { readonly id: string; readonly kind: "code"; readonly language?: string; readonly value: string }
    | { readonly id: string; readonly kind: "table"; readonly label: string; readonly rows: ReadonlyArray<ReadonlyArray<ReadonlyArray<InlineNode>>> }
    | { readonly id: string; readonly kind: "image"; readonly source: string; readonly alternative: string; readonly caption?: string }
    | { readonly id: string; readonly kind: "extension"; readonly name: string; readonly payload: unknown }

type ParsedDocument = {
    readonly blocks: ReadonlyArray<BlockNode>
    readonly outline: ReadonlyArray<{ readonly id: string; readonly label: string; readonly level: HeadingLevel }>
}

type MarkdownDocumentProps = {
    readonly source: string
    /** One when this document owns the page title; two when its host already owns the h1. */
    readonly firstHeadingLevel: 1 | 2
    readonly outline?: "off" | "derive"
    readonly selection?: "off" | "passages"
}

type ResolvedLink = {
    readonly disposition: LinkDisposition
    readonly href?: string
    readonly newContext: boolean
}

declare const parseAuthoredDocument: (source: string, firstHeadingLevel: 1 | 2) => ParsedDocument
declare const resolveDocumentLink: (destination: string) => ResolvedLink
declare const InlineContent: (props: { readonly nodes: ReadonlyArray<InlineNode>; readonly resolveLink: typeof resolveDocumentLink }) => JSX.Element
declare const SemanticHeading: (props: { readonly id: string; readonly level: HeadingLevel; readonly content: ReadonlyArray<InlineNode> }) => JSX.Element
declare const SemanticTable: (props: { readonly label: string; readonly rows: ReadonlyArray<ReadonlyArray<ReadonlyArray<InlineNode>>> }) => JSX.Element
declare const SyntaxCode: (props: { readonly language?: string; readonly value: string }) => JSX.Element
declare const DocumentImage: (props: { readonly source: string; readonly alternative: string; readonly caption?: string }) => JSX.Element
declare const DocumentExtension: (props: { readonly name: string; readonly payload: unknown }) => JSX.Element
declare const publishOutline: (outline: ParsedDocument["outline"]) => void

const passage = (enabled: boolean, id: string) => enabled
    ? { "data-selectable-passage": id }
    : {}

const semanticHeadingLevel = (authoredDepth: HeadingLevel, firstHeadingLevel: 1 | 2): HeadingLevel =>
    Math.min(6, firstHeadingLevel + authoredDepth - 1) as HeadingLevel

const renderBlock = (node: BlockNode, selectable: boolean, firstHeadingLevel: 1 | 2): JSX.Element => {
    switch (node.kind) {
    case "heading":
        return <SemanticHeading key={node.id} id={node.id} level={semanticHeadingLevel(node.authoredDepth, firstHeadingLevel)} content={node.parts} />
    case "paragraph":
        return <p key={node.id} {...passage(selectable, node.id)}><InlineContent nodes={node.parts} resolveLink={resolveDocumentLink} /></p>
    case "list": {
        const List = node.ordered ? "ol" : "ul"
        return (
            <List key={node.id} {...passage(selectable, node.id)}>
                {node.items.map((item, index) => <li key={`${node.id}-${index}`}>{item.map((child) => renderBlock(child, selectable, firstHeadingLevel))}</li>)}
            </List>
        )
    }
    case "quote":
        return <blockquote key={node.id} {...passage(selectable, node.id)}>{node.blocks.map((child) => renderBlock(child, selectable, firstHeadingLevel))}</blockquote>
    case "code":
        return (
            <div key={node.id} {...passage(selectable, node.id)} className="max-w-full min-w-0 overflow-x-auto overscroll-contain" tabIndex={0}>
                <SyntaxCode language={node.language} value={node.value} />
            </div>
        )
    case "table":
        return (
            <div key={node.id} {...passage(selectable, node.id)} className="max-w-full min-w-0 overflow-x-auto overscroll-contain" tabIndex={0}>
                <SemanticTable label={node.label} rows={node.rows} />
            </div>
        )
    case "image":
        return <DocumentImage key={node.id} source={node.source} alternative={node.alternative} caption={node.caption} />
    case "extension":
        return <DocumentExtension key={node.id} name={node.name} payload={node.payload} />
    }
}

export const MarkdownDocumentTemplate = (props: MarkdownDocumentProps) => {
    const document = parseAuthoredDocument(props.source, props.firstHeadingLevel)
    if (props.outline === "derive") publishOutline(document.outline)

    return (
        <article
            className="w-full min-w-0"
            data-selection-boundary={props.selection === "passages" ? "authored-document" : undefined}
        >
            {document.blocks.map((node) => renderBlock(node, props.selection === "passages", props.firstHeadingLevel))}
        </article>
    )
}

export const invariants = {
    semanticOutline: "the host and authored headings produce one h1-to-h6 document outline",
    listSemantics: "ordered and unordered source collections remain ol and ul",
    overflowOwner: "wide table and code blocks scroll themselves without widening the document",
    linkOwner: "one resolver classifies fragments, internal, external and blocked destinations",
    responsiveOwner: "the article shrinks in its caller; outline presentation belongs to the surrounding layout",
    optionalCapabilities: "outline and selectable passages exist only when explicitly requested",
    extensionBoundary: "tabs, accordions, diagrams and executable previews use registered extension owners",
} as const
