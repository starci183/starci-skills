import { cn } from "@heroui/react"

/**
 * Navigation geometry is SHIPPED: `.starci-core-navigation-feature-nav*` in
 * `src/common/styles.css` owns the bar, its grid, the identity/navigation/actions tracks and the
 * feature row. The sticky projection is selected there by
 * `data-grammar-navigation-feature-nav-position`, which the component already emits.
 */

export const navigationFeatureNavClassName = cn("starci-core-navigation-feature-nav") ?? "starci-core-navigation-feature-nav"

export const navigationFeatureNavPrimaryClassName = cn("starci-core-navigation-feature-nav-primary") ?? "starci-core-navigation-feature-nav-primary"

export const navigationFeatureNavIdentityClassName = cn("starci-core-navigation-feature-nav-identity") ?? "starci-core-navigation-feature-nav-identity"
export const navigationFeatureNavNavigationClassName = cn("starci-core-navigation-feature-nav-navigation") ?? "starci-core-navigation-feature-nav-navigation"
export const navigationFeatureNavCompactNavigationClassName = cn("starci-core-navigation-feature-nav-compact-navigation") ?? "starci-core-navigation-feature-nav-compact-navigation"
export const navigationFeatureNavActionsClassName = cn("starci-core-navigation-feature-nav-actions") ?? "starci-core-navigation-feature-nav-actions"
export const navigationFeatureNavFeatureClassName = cn("starci-core-navigation-feature-nav-feature") ?? "starci-core-navigation-feature-nav-feature"
