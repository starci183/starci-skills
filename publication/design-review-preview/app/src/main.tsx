import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ReviewApp } from "./review-app"
import type { ReviewManifest } from "./types"
import "@heroui/styles/css"
import "./styles.css"

const target = document.querySelector<HTMLElement>("#root")

if (!target) throw new Error("Design review root is missing")

const params = new URLSearchParams(window.location.search)
const manifestUrl = params.get("manifest") ?? "./review-manifest.json"

const load = async (): Promise<ReviewManifest> => {
  const response = await fetch(manifestUrl, {cache: "no-store"})
  if (!response.ok) throw new Error(`Review manifest returned HTTP ${response.status}`)
  const manifest = await response.json() as ReviewManifest
  if (manifest.schemaVersion !== 1) throw new Error("Unsupported review manifest schema")
  return manifest
}

const renderFailure = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  createRoot(target).render(<main className="fatal"><h1>Preview unavailable</h1><p>{message}</p></main>)
}

load()
  .then((manifest) => createRoot(target).render(<StrictMode><ReviewApp manifest={manifest} /></StrictMode>))
  .catch(renderFailure)
