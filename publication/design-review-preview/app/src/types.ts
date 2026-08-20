export type CandidateStatus = "accepted" | "proposed" | "superseded"
export type BlockStatus = "accepted" | "missing" | "stale"

export type ThemeRole = {
  readonly verdict: "reuse" | "new" | "none"
  readonly token?: string
  readonly value?: string | null
}

export type EntryVerdict = {
  readonly verdict: "reuse" | "generalize" | "new"
  readonly key?: string
  readonly from?: string
  readonly to?: string
  readonly callSites?: number
  readonly why?: string
}

export type PartReview = {
  readonly name: string
  readonly cites: Record<string, unknown>
  readonly optional?: boolean
  readonly whyMatch: string
}

export type BlockCandidate = {
  readonly id: string
  readonly hash: string
  readonly status: CandidateStatus
  readonly reason: string
  readonly axes: Record<string, string>
  readonly states: ReadonlyArray<string>
  readonly parts: ReadonlyArray<PartReview>
  readonly restingCount?: number
}

export type ChildBlockReview = {
  readonly layoutId: string
  readonly layoutHash: string
  readonly blockId: string
  readonly status: BlockStatus
  readonly currentHead?: string
  readonly recommendedId?: string
  readonly renderedId?: string
  readonly content?: ReviewContent
  readonly candidates: ReadonlyArray<BlockCandidate>
}

export type RegionReview = {
  readonly name: string
  readonly entry: EntryVerdict
  readonly assembler: string
  readonly mount: string
  readonly whyMatch: string
  readonly geometry?: {
    readonly placement: "header" | "navbar" | "rail" | "main" | "aside" | "center" | "footer" | "overlay"
    readonly width: "intrinsic" | "narrow" | "medium" | "wide" | "full"
    readonly height: "content" | "fill" | "viewport"
    readonly align: "start" | "center" | "end" | "stretch"
  }
  readonly brief?: {
    readonly kind: "form" | "navigation" | "summary" | "flow" | "content"
    readonly title: string
    readonly summary: string
    readonly items: ReadonlyArray<{
      readonly role: "shortcut" | "divider" | "field" | "choice" | "link" | "fact" | "status" | "step" | "navigation" | "text"
      readonly label: string
      readonly value?: string
    }>
    readonly primaryAction?: string
    readonly secondaryAction?: string
  }
  readonly block: ChildBlockReview
}

export type LayoutCandidate = {
  readonly id: string
  readonly hash: string
  readonly status: CandidateStatus
  readonly reason: string
  readonly axes: Record<string, string>
  readonly regions: ReadonlyArray<RegionReview>
}

export type DirectionReview = {
  readonly id: string
  readonly axes: Record<string, string>
  readonly personality: ReadonlyArray<string>
  readonly roles: Record<string, ThemeRole>
  readonly rejects: ReadonlyArray<string>
  readonly reason: string
}

export type ReviewContent = {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly primaryAction: string
  readonly rows: ReadonlyArray<{readonly title: string; readonly description: string; readonly meta?: string}>
}

export type ShellDescriptor = {
  readonly product: string
  readonly navigation: ReadonlyArray<{readonly id: string; readonly label: string}>
  readonly activeItem?: string
}

export type LayoutReview = {
  readonly layoutId: string
  readonly routePattern?: string
  readonly currentHead?: string
  readonly recommendedId: string
  readonly theme: Record<string, ThemeRole>
  readonly candidates: ReadonlyArray<LayoutCandidate>
  readonly visualDirections?: ReadonlyArray<DirectionReview>
  readonly visualDirectionRecommendation?: {readonly id: string; readonly reason: string}
  readonly shell: ShellDescriptor
  readonly content: ReviewContent
}

export type ReviewManifest = {
  readonly schemaVersion: 2
  readonly project: string
  readonly entryRoute: string
  readonly layouts: ReadonlyArray<LayoutReview>
  readonly flows?: ReadonlyArray<{
    readonly id: string
    readonly label: string
    readonly nodes: ReadonlyArray<{readonly id: string; readonly label: string; readonly layoutId: string; readonly blockId?: string; readonly order: number; readonly route: string}>
    readonly edges: ReadonlyArray<{readonly from: string; readonly to: string; readonly label?: string}>
  }>
  readonly evidence: ReadonlyArray<{readonly label: string; readonly value: string}>
}

export type ReviewRoute = {
  readonly layoutId: string
  readonly layoutHash: string
  readonly blockId?: string
}
