// Navigation, layout-chrome and data-display renderers added to the Common contract.
// Physical renderer paths follow the existing tier convention under src/core.
import { Accordion } from "../core/branch/Accordion/index.js"
import { Calendar } from "../core/branch/Calendar/index.js"
import { DataTable } from "../core/branch/DataTable/index.js"
import { Disclosure } from "../core/branch/Disclosure/index.js"
import { ListBox } from "../core/branch/ListBox/index.js"
import { AvatarGroup } from "../core/composite/AvatarGroup/index.js"
import { Breadcrumbs } from "../core/composite/Breadcrumbs/index.js"
import { DescriptionList } from "../core/composite/DescriptionList/index.js"
import { Pagination } from "../core/composite/Pagination/index.js"
import { Stepper } from "../core/composite/Stepper/index.js"
import { TagGroup } from "../core/composite/TagGroup/index.js"
import { Timeline } from "../core/composite/Timeline/index.js"
import { BottomNav } from "../core/composition/BottomNav/index.js"
import { Footer } from "../core/composition/Footer/index.js"
import { TopBar } from "../core/composition/TopBar/index.js"
import { Avatar } from "../core/primitive/Avatar/index.js"
import { Image } from "../core/primitive/Image/index.js"
import { Link } from "../core/primitive/Link/index.js"
import { Rating } from "../core/primitive/Rating/index.js"

export { Accordion, type AccordionItem, type AccordionProps } from "../core/branch/Accordion/index.js"
export { Calendar, type CalendarProps } from "../core/branch/Calendar/index.js"
export { DataTable, type DataTableColumn, type DataTableProps, type DataTableRow, type DataTableSort } from "../core/branch/DataTable/index.js"
export { Disclosure, type DisclosureProps } from "../core/branch/Disclosure/index.js"
export { ListBox, type ListBoxItem, type ListBoxProps } from "../core/branch/ListBox/index.js"
export { AvatarGroup, type AvatarGroupItem, type AvatarGroupProps } from "../core/composite/AvatarGroup/index.js"
export { Breadcrumbs, type BreadcrumbItem, type BreadcrumbsProps } from "../core/composite/Breadcrumbs/index.js"
export { DescriptionList, type DescriptionListItem, type DescriptionListProps } from "../core/composite/DescriptionList/index.js"
export { Pagination, paginationTokens, type PaginationProps, type PaginationToken } from "../core/composite/Pagination/index.js"
export { Stepper, stepStateFor, type StepperProps, type StepperStep, type StepperStepState } from "../core/composite/Stepper/index.js"
export { TagGroup, type TagGroupItem, type TagGroupProps } from "../core/composite/TagGroup/index.js"
export { Timeline, type TimelineItem, type TimelineProps } from "../core/composite/Timeline/index.js"
export { BottomNav, type BottomNavItem, type BottomNavProps } from "../core/composition/BottomNav/index.js"
export { Footer, type FooterLink, type FooterLinkGroup, type FooterProps } from "../core/composition/Footer/index.js"
export { TopBar, type TopBarMenu, type TopBarProps } from "../core/composition/TopBar/index.js"
export { Avatar, avatarInitials, type AvatarProps, type AvatarSize } from "../core/primitive/Avatar/index.js"
export { Image, type ImageAspect, type ImageLoadState, type ImageProps } from "../core/primitive/Image/index.js"
export { Link, type LinkKind, type LinkProps } from "../core/primitive/Link/index.js"
export { Rating, type RatingProps } from "../core/primitive/Rating/index.js"

/** Every navigation-group renderer, spread into `COMMON_GRAMMAR_COMPONENTS`. */
export const COMMON_NAVIGATION_COMPONENTS = Object.freeze({
    Accordion, Avatar, AvatarGroup, BottomNav, Breadcrumbs, Calendar, DataTable, DescriptionList,
    Disclosure, Footer, Image, Link, ListBox, Pagination, Rating, Stepper, TagGroup, Timeline, TopBar,
} as const)
