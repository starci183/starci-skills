export type PreviewViewport = {
  readonly width: number
  readonly height: number
}

export type HtmlPreviewState = {
  readonly id: string
  readonly html: string
  readonly viewport: PreviewViewport
}

export type HtmlPreview = {
  readonly html: string
  readonly states: ReadonlyArray<HtmlPreviewState>
}

export type RegionReview = {
  readonly name: string
  readonly pageId?: string
  readonly change?: "existing" | "proposed" | "new"
  readonly entry: Record<string, unknown>
  readonly assembler: string
  readonly mount: string
  readonly whyMatch: string
  readonly geometry?: Record<string, unknown>
  readonly brief?: Record<string, unknown>
}

export type LayoutCandidate = {
  readonly id: string
  readonly hash: string
  readonly status: "proposed"
  readonly reason: string
  readonly axes: Record<string, string>
  readonly pages?: ReadonlyArray<Record<string, unknown>>
  readonly regions: ReadonlyArray<RegionReview>
  readonly preview: HtmlPreview
}

export type LayoutReview = {
  readonly layoutId: string
  readonly recommendedId: string
  readonly scope?: Record<string, unknown>
  readonly theme: Record<string, {readonly value?: string | null}>
  readonly candidates: ReadonlyArray<LayoutCandidate>
}

export type ReviewManifest = {
  readonly schemaVersion: 3
  readonly project: string
  readonly sessionId: string
  readonly phase: "layout" | "block"
  readonly entryRoute: string
  readonly layouts: ReadonlyArray<LayoutReview>
  readonly evidence: ReadonlyArray<{readonly label: string; readonly value: string}>
}

export type ReviewRoute = {
  readonly layoutId: string
  readonly candidateKey: string
}
