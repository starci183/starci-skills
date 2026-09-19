import { forwardRef, type ReactNode, type SVGProps } from "react"

/** Props shared by StarCi micro cuts that follow Heroicons' accessible SVG surface. */
export type StarCiSolidIconProps = SVGProps<SVGSVGElement> & {
    readonly title?: string
    readonly titleId?: string
}

/** Build one fixed 16px solid cut while preserving Heroicons-compatible SVG props. */
const solidIcon = (name: string, body: ReactNode) => {
    const Component = forwardRef<SVGSVGElement, StarCiSolidIconProps>((props, ref) => {
        const { title, titleId, ...svgProps } = props
        return (
            <svg
                ref={ref}
                {...svgProps}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden={title === undefined ? "true" : undefined}
                aria-labelledby={title === undefined ? undefined : titleId}
                data-slot="icon"
            >
                {title === undefined ? null : <title id={titleId}>{title}</title>}
                {body}
            </svg>
        )
    })
    Component.displayName = name
    return Component
}

/** Empty completion ring missing from upstream Heroicons' 16px solid family. */
export const CircleIcon = solidIcon("CircleIcon", (
    <path fillRule="evenodd" clipRule="evenodd" d="M8 1.25a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.75 8a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Z" />
))

/** Solid micro cut for the persistent two-pane course rail. */
export const CourseRailIcon = solidIcon("CourseRailIcon", (
    <path fillRule="evenodd" clipRule="evenodd" d="M2.75 2A1.75 1.75 0 0 0 1 3.75v8.5C1 13.216 1.784 14 2.75 14h10.5A1.75 1.75 0 0 0 15 12.25v-8.5A1.75 1.75 0 0 0 13.25 2H2.75ZM2.5 3.75c0-.138.112-.25.25-.25H6v9H2.75a.25.25 0 0 1-.25-.25v-8.5Zm5 8.75v-9h5.75c.138 0 .25.112.25.25v8.5a.25.25 0 0 1-.25.25H7.5Z" />
))

/** Solid micro cut for the course overview destination. */
export const CourseOverviewIcon = solidIcon("CourseOverviewIcon", (
    <>
        <path fillRule="evenodd" clipRule="evenodd" d="M2.75 1.5A1.75 1.75 0 0 0 1 3.25v9.5c0 .966.784 1.75 1.75 1.75h10.5A1.75 1.75 0 0 0 15 12.75v-9.5a1.75 1.75 0 0 0-1.75-1.75H2.75Zm-.25 1.75c0-.138.112-.25.25-.25h10.5c.138 0 .25.112.25.25v9.5a.25.25 0 0 1-.25.25H2.75a.25.25 0 0 1-.25-.25v-9.5Z" />
        <path d="m4.5 7.25 3.5-3 3.5 3v4.25H9v-2H7v2H4.5V7.25Z" />
    </>
))

/** Solid micro cut for structured course content. */
export const CourseContentIcon = solidIcon("CourseContentIcon", (
    <path d="M1.5 2.25A1.25 1.25 0 0 1 2.75 1h2.5A3.5 3.5 0 0 1 8 2.333 3.5 3.5 0 0 1 10.75 1h2.5a1.25 1.25 0 0 1 1.25 1.25v9.5A1.25 1.25 0 0 1 13.25 13h-2.5A2.75 2.75 0 0 0 8.6 14.034a.75.75 0 0 1-1.2 0A2.75 2.75 0 0 0 5.25 13h-2.5a1.25 1.25 0 0 1-1.25-1.25v-9.5ZM3.75 4a.625.625 0 1 0 0 1.25H5.5A.625.625 0 1 0 5.5 4H3.75Zm0 2.75a.625.625 0 1 0 0 1.25H5.5a.625.625 0 1 0 0-1.25H3.75ZM10.5 4a.625.625 0 1 0 0 1.25h1.75a.625.625 0 1 0 0-1.25H10.5Zm0 2.75a.625.625 0 1 0 0 1.25h1.75a.625.625 0 1 0 0-1.25H10.5Z" />
))

/** Solid micro cut for a personal code project artifact. */
export const PersonalProjectIcon = solidIcon("PersonalProjectIcon", (
    <>
        <path fillRule="evenodd" clipRule="evenodd" d="M2.75 1.5A1.75 1.75 0 0 0 1 3.25v9.5c0 .966.784 1.75 1.75 1.75h10.5A1.75 1.75 0 0 0 15 12.75v-9.5a1.75 1.75 0 0 0-1.75-1.75H2.75Zm-.25 3h11v8.25a.25.25 0 0 1-.25.25H2.75a.25.25 0 0 1-.25-.25V4.5Z" />
        <path d="M5.28 7.03a.75.75 0 0 1 0 1.06L4.37 9l.91.91a.75.75 0 1 1-1.06 1.06l-1.44-1.44a.75.75 0 0 1 0-1.06l1.44-1.44a.75.75 0 0 1 1.06 0Zm5.44 0a.75.75 0 0 1 1.06 0l1.44 1.44a.75.75 0 0 1 0 1.06l-1.44 1.44a.75.75 0 0 1-1.06-1.06l.91-.91-.91-.91a.75.75 0 0 1 0-1.06ZM8.73 6.3a.75.75 0 0 1 .47.95l-1.25 4a.75.75 0 0 1-1.43-.45l1.25-4a.75.75 0 0 1 .96-.5Z" />
    </>
))

/** Solid micro cut for a stack of review flashcards. */
export const FlashcardsIcon = solidIcon("FlashcardsIcon", (
    <>
        <path d="M4.5 2.75A1.75 1.75 0 0 1 6.25 1h6A1.75 1.75 0 0 1 14 2.75v7.5A1.75 1.75 0 0 1 12.25 12h-.75V5.75A2.75 2.75 0 0 0 8.75 3H4.5v-.25Z" />
        <path fillRule="evenodd" clipRule="evenodd" d="M2.75 4A1.75 1.75 0 0 0 1 5.75v7.5C1 14.216 1.784 15 2.75 15h6.5A1.75 1.75 0 0 0 11 13.25v-7.5A1.75 1.75 0 0 0 9.25 4h-6.5Zm1.5 5.25a.75.75 0 0 0 0 1.5h3.69l-.47.47a.75.75 0 1 0 1.06 1.06l1.75-1.75a.75.75 0 0 0 0-1.06L8.53 7.72a.75.75 0 0 0-1.06 1.06l.47.47H4.25Z" />
    </>
))

/** Solid micro cut for a three-place course leaderboard. */
export const CourseLeaderboardIcon = solidIcon("CourseLeaderboardIcon", (
    <path d="M6 5.5A1.5 1.5 0 0 1 7.5 4h1A1.5 1.5 0 0 1 10 5.5V14H6V5.5ZM1 9.5A1.5 1.5 0 0 1 2.5 8h1A1.5 1.5 0 0 1 5 9.5V14H1V9.5Zm10-2A1.5 1.5 0 0 1 12.5 6h1A1.5 1.5 0 0 1 15 7.5V14h-4V7.5ZM7.25 1.25A.75.75 0 0 1 8 .5h.75v2.25H9.5a.75.75 0 0 1 0 1.5H6.75a.75.75 0 0 1 0-1.5h.5v-1.5Z" />
))

/** Solid micro cut for course questions paired with answers. */
export const CourseQaIcon = solidIcon("CourseQaIcon", (
    <>
        <path fillRule="evenodd" clipRule="evenodd" d="M2.75 1A1.75 1.75 0 0 0 1 2.75v5.5C1 9.216 1.784 10 2.75 10H3v2.25a.75.75 0 0 0 1.218.586L7.62 10h1.63A1.75 1.75 0 0 0 11 8.25v-5.5A1.75 1.75 0 0 0 9.25 1h-6.5ZM3 2.5a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5h1.5v1.39L7.168 8.5H9a.5.5 0 0 0 .5-.5V3a.5.5 0 0 0-.5-.5H3Z" />
        <path d="M11.75 5H13.25A1.75 1.75 0 0 1 15 6.75v5.5A1.75 1.75 0 0 1 13.25 14H13v1.25a.75.75 0 0 1-1.218.586L9.58 14H7.75A1.75 1.75 0 0 1 6 12.25V11.5h3.25a3.25 3.25 0 0 0 3.25-3.25v-3.2a1.87 1.87 0 0 0-.75-.05Z" />
        <path d="M5.9 3.25c-1.025 0-1.8.57-2.038 1.45a.6.6 0 1 0 1.158.314c.09-.333.35-.564.88-.564.56 0 .9.29.9.7 0 .32-.17.49-.62.75-.67.39-1.08.82-1.08 1.55a.6.6 0 1 0 1.2 0c0-.22.1-.36.48-.58.67-.39 1.22-.85 1.22-1.72 0-1.13-.91-1.9-2.1-1.9ZM5.7 8.05a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4Z" />
    </>
))

/** Solid micro cut for a central thought and its connected branches. */
export const MindMapIcon = solidIcon("MindMapIcon", (
    <>
        <path d="M7.25 6.25h1.5a1 1 0 0 1 1 1v1.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1.5a1 1 0 0 1 1-1Z" />
        <path d="M2 1.5h3v2H2v-2Zm9 0h3v2h-3v-2ZM2 12.5h3v2H2v-2Zm9 0h3v2h-3v-2ZM7.5 3.5h1v2.75h-1V3.5Zm0 6.25h1v2.75h-1V9.75ZM5 2h6v1H5V2Zm0 11h6v1H5v-1ZM3.5 3.5h1v9h-1v-9Zm8 0h1v9h-1v-9Z" />
    </>
))

/** Solid micro cut for a live interview microphone. */
export const MockInterviewIcon = solidIcon("MockInterviewIcon", (
    <path d="M7 1.5a2 2 0 0 1 4 0v4a2 2 0 1 1-4 0v-4ZM4.75 5a.75.75 0 0 1 .75.75 3.5 3.5 0 1 0 7 0 .75.75 0 0 1 1.5 0 5.002 5.002 0 0 1-4.25 4.944V13h1.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5h1.5v-2.306A5.002 5.002 0 0 1 4 5.75.75.75 0 0 1 4.75 5Z" />
))

/** Solid micro cut for one foundation block supported by two lower blocks. */
export const FoundationsIcon = solidIcon("FoundationsIcon", (
    <>
        <path d="M6 1.5h4A1.5 1.5 0 0 1 11.5 3v3H4.5V3A1.5 1.5 0 0 1 6 1.5ZM2 7h5.25v5H1V8a1 1 0 0 1 1-1Zm6.75 0H14a1 1 0 0 1 1 1v4H8.75V7Z" />
        <path d="M.75 13h14.5a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1 0-1.5Z" />
    </>
))

/** Solid micro cut for a bounded terminal playground. */
export const PlaygroundIcon = solidIcon("PlaygroundIcon", (
    <>
        <path fillRule="evenodd" clipRule="evenodd" d="M2.75 2A1.75 1.75 0 0 0 1 3.75v8.5C1 13.216 1.784 14 2.75 14h10.5A1.75 1.75 0 0 0 15 12.25v-8.5A1.75 1.75 0 0 0 13.25 2H2.75Zm-.25 1.75c0-.138.112-.25.25-.25h10.5c.138 0 .25.112.25.25v8.5a.25.25 0 0 1-.25.25H2.75a.25.25 0 0 1-.25-.25v-8.5Z" />
        <path d="M4.47 6.22a.75.75 0 0 1 1.06 0l1.25 1.25a.75.75 0 0 1 0 1.06L5.53 9.78a.75.75 0 0 1-1.06-1.06L5.19 8l-.72-.72a.75.75 0 0 1 0-1.06ZM8.25 9.5a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75Z" />
    </>
))
