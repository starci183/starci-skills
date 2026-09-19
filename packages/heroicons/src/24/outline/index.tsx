import { forwardRef, type ReactNode, type SVGProps } from "react"

/** Props shared by StarCi cuts that follow Heroicons' accessible SVG surface. */
export type StarCiOutlineIconProps = SVGProps<SVGSVGElement> & {
    readonly title?: string
    readonly titleId?: string
}

/** Build one fixed 24px outline cut while preserving Heroicons-compatible SVG props. */
const outlineIcon = (name: string, body: ReactNode) => {
    const Component = forwardRef<SVGSVGElement, StarCiOutlineIconProps>((props, ref) => {
        const { title, titleId, ...svgProps } = props
        return (
            <svg
                ref={ref}
                {...svgProps}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
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

/** Empty completion ring missing from upstream Heroicons. */
export const CircleIcon = outlineIcon("CircleIcon", (
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
))

/** Shared medal silhouette with an authored place numeral. */
const placeMedal = (name: string, numeral: ReactNode) => outlineIcon(name, (
    <>
        <path strokeLinecap="round" strokeLinejoin="round" d="m8 3 4 6 4-6m-8 0H5.5l4 7.2m6.5-7.2h2.5l-4 7.2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 15.75a6.75 6.75 0 1 1-13.5 0 6.75 6.75 0 0 1 13.5 0Z" />
        {numeral}
    </>
))

/** First-place medal custom cut. */
export const FirstPlaceMedalIcon = placeMedal("FirstPlaceMedalIcon", (
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 13.25h1.25v5m-1.25 0h2.5" />
))

/** Second-place medal custom cut. */
export const SecondPlaceMedalIcon = placeMedal("SecondPlaceMedalIcon", (
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 14.25c.25-1 1.1-1.5 2.25-1.5 1.25 0 2.25.7 2.25 1.75 0 1.75-2.25 2.25-4.5 3.75h4.75" />
))

/** Third-place medal custom cut. */
export const ThirdPlaceMedalIcon = placeMedal("ThirdPlaceMedalIcon", (
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 13h2.25c1.15 0 2 .6 2 1.5s-.85 1.5-2 1.5H11.5h.75c1.3 0 2.25.65 2.25 1.6 0 1.05-.95 1.65-2.35 1.65H10" />
))

/** The course overview destination: a home held inside the active learning surface. */
export const CourseOverviewIcon = outlineIcon("CourseOverviewIcon", (
    <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5h15A1.5 1.5 0 0 1 21 6v12a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V6a1.5 1.5 0 0 1 1.5-1.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m7.5 11.25 4.5-3.75 4.5 3.75v5.25h-9v-5.25Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 16.5v-3h3v3" />
    </>
))

/** An open course text with independently scannable lesson lines on both pages. */
export const CourseContentIcon = outlineIcon("CourseContentIcon", (
    <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5h3.75A3.75 3.75 0 0 1 12 8.25v11.25a3.75 3.75 0 0 0-3.75-3.75H4.5V4.5Zm15 0h-3.75A3.75 3.75 0 0 0 12 8.25v11.25a3.75 3.75 0 0 1 3.75-3.75h3.75V4.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 8.25h2.5m-2.5 3h2.5m5.5-3h2.5m-2.5 3h2.5" />
    </>
))

/** A bounded project artifact containing authored code rather than generic practice. */
export const PersonalProjectIcon = outlineIcon("PersonalProjectIcon", (
    <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 3.75h15A1.5 1.5 0 0 1 21 5.25v13.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.75V5.25a1.5 1.5 0 0 1 1.5-1.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h18M6 5.625h.008m2.242 0h.008" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m9.25 11-2 2 2 2m5.5-4 2 2-2 2m-2.25-5-1 6" />
    </>
))

/** Two study cards with a forward cue for moving through a review deck. */
export const FlashcardsIcon = outlineIcon("FlashcardsIcon", (
    <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 5.25V4.5A1.5 1.5 0 0 1 7.5 3h10.125A1.875 1.875 0 0 1 19.5 4.875V15a1.5 1.5 0 0 1-1.5 1.5h-.75" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.75h10.125A1.875 1.875 0 0 1 16.5 8.625V18a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 18V8.25a1.5 1.5 0 0 1 1.5-1.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 13.125h6m-2.25-2.25 2.25 2.25-2.25 2.25" />
    </>
))

/** A first-place center podium flanked by the next two ranked places. */
export const CourseLeaderboardIcon = outlineIcon("CourseLeaderboardIcon", (
    <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5v-5.25H9v5.25m0 0V9.75h6v9.75m0 0v-7.5h4.5v7.5M3 19.5h18" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 6h1.5v2.25m-1.5 0h3" />
    </>
))

/** Course questions and answers as a question bubble paired with its response. */
export const CourseQaIcon = outlineIcon("CourseQaIcon", (
    <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5h9A1.5 1.5 0 0 1 15 6v6a1.5 1.5 0 0 1-1.5 1.5H9l-3.75 3v-3H4.5A1.5 1.5 0 0 1 3 12V6a1.5 1.5 0 0 1 1.5-1.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 8.25h4.5A1.5 1.5 0 0 1 21 9.75v6a1.5 1.5 0 0 1-1.5 1.5h-.75v3l-3.75-3h-3a1.5 1.5 0 0 1-1.5-1.5V13.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.125 7.875A1.875 1.875 0 1 1 9 9.75v.375M9 12h.008" />
    </>
))

/** Two persistent panes separated by the boundary controlled by the course-rail toggle. */
export const CourseRailIcon = outlineIcon("CourseRailIcon", (
    <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5h15A1.5 1.5 0 0 1 21 6v12a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V6a1.5 1.5 0 0 1 1.5-1.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15" />
    </>
))

/** A central thought connected to four independently addressable branches. */
export const MindMapIcon = outlineIcon("MindMapIcon", (
    <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75V7.5m0 6.75v2.25M9.75 12H7.5m6.75 0h2.25M12 7.5 7.5 5.25M12 7.5l4.5-2.25M12 16.5l-4.5 2.25M12 16.5l4.5 2.25" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 10.5A.75.75 0 0 1 10.5 9.75h3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-.75.75h-3a.75.75 0 0 1-.75-.75v-3ZM5.25 3.75h4.5v3h-4.5v-3Zm9 0h4.5v3h-4.5v-3Zm-9 13.5h4.5v3h-4.5v-3Zm9 0h4.5v3h-4.5v-3Z" />
    </>
))

/** A live interview microphone paired with the prompt notes the learner answers. */
export const MockInterviewIcon = outlineIcon("MockInterviewIcon", (
    <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5a2.25 2.25 0 0 1 4.5 0v5.25a2.25 2.25 0 0 1-4.5 0V4.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9.75a5.25 5.25 0 0 0 10.5 0M13.5 15v4.5m-2.25 0h4.5M4.5 6h3m-3 3h2.25m-2.25 3h3" />
    </>
))

/** One course foundation block supported by two lower prerequisite blocks and a baseline. */
export const FoundationsIcon = outlineIcon("FoundationsIcon", (
    <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5h6v4.5H9V4.5ZM4.5 10.5h6V15h-6v-4.5Zm9 0h6V15h-6v-4.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 18h18" />
    </>
))

/** A bounded terminal prompt for an executable, disposable learning environment. */
export const PlaygroundIcon = outlineIcon("PlaygroundIcon", (
    <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5h15A1.5 1.5 0 0 1 21 6v12a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V6a1.5 1.5 0 0 1 1.5-1.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m7.5 9 2.25 2.25L7.5 13.5m4.5 0h4.5" />
    </>
))
