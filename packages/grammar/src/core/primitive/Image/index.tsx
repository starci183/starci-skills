"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { navigationClassName } from "../../navigationClassNames.js"

export type ImageAspect = "square" | "landscape" | "portrait" | "wide" | "auto"
export type ImageLoadState = "loading" | "loaded" | "error"

export type ImageProps = {
    readonly src: string
    /** Required. Pass "" only for a purely decorative image. */
    readonly alt: string
    /** square 1:1, landscape 4:3, portrait 3:4, wide 16:9; auto keeps the intrinsic ratio. */
    readonly aspect?: ImageAspect
    readonly fit?: "cover" | "contain"
    /** Rendered instead of the image when it fails to load. */
    readonly fallback?: ReactNode
    /** Offscreen images defer by default; above-the-fold art may be eager. */
    readonly loading?: "lazy" | "eager"
    readonly srcSet?: string
    readonly sizes?: string
    readonly width?: number
    readonly height?: number
    readonly onLoadStateChange?: (state: ImageLoadState) => void
    readonly className?: string
}

/**
 * A reserved-ratio image with loading, loaded and error states.
 *
 * The box claims its aspect ratio before the bytes arrive, so lazy images never shift the page.
 * `MediaFrame` frames approved art with a caption; `Image` is the element inside or outside it.
 */
export const Image = ({
    src,
    alt,
    aspect = "auto",
    fit = "cover",
    fallback,
    loading = "lazy",
    srcSet,
    sizes,
    width,
    height,
    onLoadStateChange,
    className,
}: ImageProps) => {
    const [state, setState] = useState<ImageLoadState>("loading")
    const imageRef = useRef<HTMLImageElement>(null)
    const report = (next: ImageLoadState) => {
        setState(next)
        onLoadStateChange?.(next)
    }
    useEffect(() => {
        setState("loading")
        // A cached image can finish before hydration attaches onLoad.
        const image = imageRef.current
        if (image !== null && image.complete && image.naturalWidth > 0) report("loaded")
    }, [src])

    const showFallback = state === "error" && fallback !== undefined
    return (
        <span
            className={navigationClassName("starci-core-image", className)}
            data-component="Image"
            data-tier="atom"
            data-grammar-image-aspect={aspect}
            data-grammar-image-fit={fit}
            data-grammar-image-state={state}
        >
            {showFallback ? (
                <span
                    className="starci-core-image-fallback"
                    data-grammar-image-fallback="true"
                    {...(alt === "" ? { "aria-hidden": true } : { role: "img", "aria-label": alt })}
                >{fallback}</span>
            ) : (
                <img
                    ref={imageRef}
                    alt={alt}
                    className="starci-core-image-element"
                    decoding="async"
                    loading={loading}
                    src={src}
                    {...(srcSet === undefined ? {} : { srcSet })}
                    {...(sizes === undefined ? {} : { sizes })}
                    {...(width === undefined ? {} : { width })}
                    {...(height === undefined ? {} : { height })}
                    onError={() => report("error")}
                    onLoad={() => report("loaded")}
                />
            )}
        </span>
    )
}
