export type ReviewPhase = "layout" | "block"
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

export type RegionReview = {
  readonly name: string
  readonly entry: EntryVerdict
  readonly assembler: string
  readonly mount: string
  readonly whyMatch: string
  readonly blockStatus: BlockStatus
  readonly blockHead?: string
}

export type PartReview = {
  readonly name: string
  readonly cites: Record<string, unknown>
  readonly optional?: boolean
  readonly whyMatch: string
}

export type ReviewCandidate = {
  readonly id: string
  readonly hash: string
  readonly status: CandidateStatus
  readonly reason: string
  readonly axes: Record<string, string>
  readonly regions?: ReadonlyArray<RegionReview>
  readonly states?: ReadonlyArray<string>
  readonly parts?: ReadonlyArray<PartReview>
  readonly restingCount?: number
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

export type ReviewManifest = {
  readonly schemaVersion: 1
  readonly phase: ReviewPhase
  readonly project: string
  readonly identity: {
    readonly layoutId: string
    readonly blockId?: string
    readonly parentLayoutHash?: string
  }
  readonly artifact: {
    readonly source: string
    readonly currentHead?: string
    readonly recommendedId: string
  }
  readonly theme: Record<string, ThemeRole>
  readonly candidates: ReadonlyArray<ReviewCandidate>
  readonly visualDirections?: ReadonlyArray<DirectionReview>
  readonly visualDirectionRecommendation?: {readonly id: string; readonly reason: string}
  readonly shell: ShellDescriptor
  readonly content: ReviewContent
  readonly evidence: ReadonlyArray<{readonly label: string; readonly value: string}>
}

export type Inspector = {
  readonly kind: "region" | "part" | "candidate" | "evidence" | "approval"
  readonly title: string
  readonly subtitle: string
  readonly data: unknown
}
