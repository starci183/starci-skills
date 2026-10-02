/**
 * Twin tests for the hygiene rules (`FE_EFFECT_CLEANUP`, `FE_EFFECT_FETCH`, `FE_SWALLOWED_ERROR`, `FE_CONSOLE_CALL`).
 *
 *   node --test hygiene.spec.mjs
 *
 * The effect rules decide by resolution (React's export, the platform's symbol, the checker's promise type), so they run
 * under the typed tester; a case's `filename` is a virtual file typed by the fixture project.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { at, slotTester, typedTester } from "./fixtures/typed/tester.mjs"
import { effectSubscriptionNeedsCleanup, noConsole, noDataFetchInEffect, noEmptyCatch, rules } from "./hygiene.mjs"

const syntaxTester = slotTester()
const typed = typedTester()

const FILE = at("apps/web/src/components/blocks/Feed/index.tsx")
const HOOK = at("apps/web/src/hooks/lesson/useLesson.ts")
const MODULE = at("apps/web/src/modules/api/client.ts")
const PLAIN_FILE = at("apps/web/src/components/blocks/Feed/index.tsx")

/** The imports every effect case starts with. */
const REACT = "import { useEffect, useLayoutEffect, useSyncExternalStore } from \"react\"\n"
const withReact = (code) => `${REACT}${code}`

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

const unreleased = [{ messageId: "unreleased" }]
const orphan = [{ messageId: "orphan" }]

test("HYGIENE-1: timers and frames", () => {
  typed.run("effect-subscription-needs-cleanup", effectSubscriptionNeedsCleanup, {
    valid: [
      { filename: FILE, code: withReact("useEffect(() => { const id = setTimeout(() => set(false), 300); return () => clearTimeout(id) }, [])") },
      { filename: FILE, code: "import * as React from \"react\"\nReact.useEffect(() => { const id = window.setInterval(tick, 1000); return () => { window.clearInterval(id) } }, [])\ndeclare const tick: () => void" },
      { filename: FILE, code: withReact("useLayoutEffect(() => { const id = requestAnimationFrame(draw); return () => cancelAnimationFrame(id) }, [])\ndeclare const draw: () => void") },
      // a loop of frames: the id lives outside the callback, the cleanup cancels the latest one
      { filename: FILE, code: withReact("useEffect(() => { let id = 0; const tick = () => { id = requestAnimationFrame(tick) }; id = requestAnimationFrame(tick); return () => cancelAnimationFrame(id) }, [])") },
      // the handle in a ref
      { filename: FILE, code: withReact("declare const timerRef: { current: number | undefined }\nuseEffect(() => { timerRef.current = window.setTimeout(run, 5); return () => window.clearTimeout(timerRef.current) }, [])\ndeclare const run: () => void") },
      // handles collected in a list and cleared through it
      { filename: FILE, code: withReact("useEffect(() => { const ids: number[] = []; ids.push(window.setTimeout(a, 1)); ids.push(window.setTimeout(b, 2)); return () => ids.forEach(clearTimeout) }, [])\ndeclare const a: () => void\ndeclare const b: () => void") },
      // the cleanup is a named function, or calls one
      { filename: FILE, code: withReact("useEffect(() => { const id = setTimeout(a, 1); const stop = () => clearTimeout(id); return stop }, [])\ndeclare const a: () => void") },
      { filename: FILE, code: withReact("useEffect(() => { const id = setTimeout(a, 1); function teardown() { clearTimeout(id) } return () => { teardown() } }, [])\ndeclare const a: () => void") },
      // a debounce started from a listener the effect registers: the handle lives in the effect and the cleanup clears it
      { filename: FILE, code: withReact("useEffect(() => { let t: number | undefined; const onResize = () => { clearTimeout(t); t = window.setTimeout(measure, 100) }; window.addEventListener(\"resize\", onResize); return () => { window.removeEventListener(\"resize\", onResize); clearTimeout(t) } }, [])\ndeclare const measure: () => void") },
      // useSyncExternalStore: a shared useNow shape, subscribe passed by name, the handle a module-level let
      {
        filename: HOOK,
        code: withReact("const listeners = new Set<() => void>()\nlet timer: ReturnType<typeof setInterval> | undefined\nconst tick = () => { for (const l of listeners) l() }\nconst subscribe = (listener: () => void): (() => void) => { listeners.add(listener); if (timer === undefined) timer = setInterval(tick, 60000); return () => { listeners.delete(listener); if (listeners.size === 0 && timer !== undefined) { clearInterval(timer); timer = undefined } } }\nexport const useNow = () => useSyncExternalStore(subscribe, () => 1, () => null)"),
      },
      { filename: HOOK, code: withReact("useSyncExternalStore((cb) => { const id = window.setTimeout(cb, 5); return () => window.clearTimeout(id) }, () => 1)") },
      // outside any effect a timer is fine when the function that starts it releases it (the API client's timeout)
      { filename: MODULE, code: "declare const controller: AbortController\ndeclare function run(): Promise<void>\nexport const call = async () => { const id = setTimeout(() => controller.abort(), 5000); try { await run() } finally { clearTimeout(id) } }" },
      { filename: HOOK, code: "export function subscribe(cb: () => void) { const id = window.setTimeout(cb, 5); return () => window.clearTimeout(id) }" },
      // a homonym is not the platform's timer, and a local `useEffect` is not React's
      { filename: FILE, code: withReact("declare function setTimeout(cb: () => void, ms: number): void\nuseEffect(() => { setTimeout(() => undefined, 1) }, [])") },
      { filename: FILE, code: "declare function useEffect(cb: () => void): void\nuseEffect(() => { window.addEventListener(\"x\", () => undefined) })" },
    ],
    invalid: [
      { filename: FILE, code: withReact("useEffect(() => { setTimeout(() => set(false), 300) }, [])\ndeclare const set: (v: boolean) => void"), errors: unreleased },
      { filename: FILE, code: withReact("useEffect(() => { const id = setInterval(tick, 1000); return () => undefined }, [])\ndeclare const tick: () => void"), errors: unreleased },
      { filename: FILE, code: withReact("useLayoutEffect(() => { const id = setTimeout(a, 1); return undefined }, [])\ndeclare const a: () => void"), errors: unreleased },
      { filename: FILE, code: "import * as React from \"react\"\nReact.useEffect(() => { const id = setTimeout(a, 1) }, [])\ndeclare const a: () => void", errors: unreleased },
      { filename: FILE, code: "import { useEffect as useMount } from \"react\"\nuseMount(() => { const id = setTimeout(a, 1) }, [])\ndeclare const a: () => void", errors: unreleased },
      // the cleanup clears something else (the old rule accepted any clearTimeout in the cleanup)
      { filename: FILE, code: withReact("useEffect(() => { const a = setTimeout(f, 5); const b = setTimeout(f, 6); return () => clearTimeout(b) }, [])\ndeclare const f: () => void"), errors: unreleased },
      { filename: FILE, code: withReact("useEffect(() => { const id = setTimeout(f, 5); return () => { const id = 1; clearTimeout(id) } }, [])\ndeclare const f: () => void"), errors: unreleased },
      // a timer started in a listener whose handle no cleanup can reach
      { filename: FILE, code: withReact("useEffect(() => { const onClick = () => { const id = setTimeout(f, 5) }; window.addEventListener(\"click\", onClick); return () => window.removeEventListener(\"click\", onClick) }, [])\ndeclare const f: () => void"), errors: unreleased },
      // a frame that is never cancelled, and one cancelled with the wrong id
      { filename: FILE, code: withReact("useEffect(() => { const id = requestAnimationFrame(f) }, [])\ndeclare const f: () => void"), errors: unreleased },
      { filename: FILE, code: withReact("useEffect(() => { const a = requestAnimationFrame(f); const b = 1; return () => cancelAnimationFrame(b) }, [])\ndeclare const f: () => void"), errors: unreleased },
      // a timer cleared with the frame canceller does not end the timer
      { filename: FILE, code: withReact("useEffect(() => { const id = setTimeout(f, 5); return () => cancelAnimationFrame(id) }, [])\ndeclare const f: () => void"), errors: unreleased },
      // the module exemption is gone: a module's timer is judged by structure like any other
      { filename: MODULE, code: "export const start = () => { setTimeout(() => undefined, 5000) }", errors: orphan },
      { filename: MODULE, code: withReact("useEffect(() => { const id = setInterval(f, 1); }, [])\ndeclare const f: () => void"), errors: unreleased },
      // useSyncExternalStore: the unsubscribe never clears the timer / clears another
      { filename: HOOK, code: withReact("const listeners = new Set<() => void>()\nlet timer: number | undefined\nconst subscribe = (l: () => void) => { listeners.add(l); timer = window.setInterval(l, 60000); return () => { listeners.delete(l) } }\nexport const useNow = () => useSyncExternalStore(subscribe, () => 1)"), errors: unreleased },
      { filename: HOOK, code: withReact("useSyncExternalStore((cb) => { const a = window.setTimeout(cb, 5); const b = 1; return () => window.clearTimeout(b) }, () => 1)"), errors: unreleased },
      // outside any effect: nothing in the function releases the timer
      { filename: FILE, code: "declare const set: (v: boolean) => void\nconst onClick = () => { setTimeout(() => set(false), 300) }", errors: orphan },
      { filename: FILE, code: "declare const refresh: () => void\nwindow.setTimeout(refresh, 1000)", errors: orphan },
      { filename: FILE, code: "declare const listeners: Set<() => void>\nlet timer: number | undefined\nconst subscribe = (l: () => void) => { listeners.add(l); timer = setInterval(l, 60000); return () => { listeners.delete(l) } }", errors: orphan },
      { filename: FILE, code: "const subscribe = (cb: () => void) => { const a = setTimeout(cb, 5); const b = 1; return () => clearTimeout(b) }", errors: orphan },
      // a timer with no handle cannot be cleared
      { filename: FILE, code: "const subscribe = (cb: () => void) => { setTimeout(cb, 5); return () => clearTimeout(1) }", errors: orphan },
    ],
  })
})

test("HYGIENE-1b: listeners", () => {
  typed.run("effect-subscription-needs-cleanup", effectSubscriptionNeedsCleanup, {
    valid: [
      { filename: FILE, code: withReact("useEffect(() => { const onResize = () => undefined; window.addEventListener(\"resize\", onResize); return () => window.removeEventListener(\"resize\", onResize) }, [])") },
      // the global object under any of its names, and the bare form, are one target
      { filename: FILE, code: withReact("useEffect(() => { const h = () => undefined; addEventListener(\"resize\", h); return () => window.removeEventListener(\"resize\", h) }, [])") },
      { filename: FILE, code: withReact("useEffect(() => { const h = () => undefined; globalThis.addEventListener(\"resize\", h); return () => { window.removeEventListener(\"resize\", h) } }, [])") },
      { filename: FILE, code: withReact("useEffect(() => { const h = () => undefined; document.addEventListener(\"keydown\", h, true); return () => document.removeEventListener(\"keydown\", h, true) }, [])") },
      // a target held in a variable, and one held in a ref
      { filename: FILE, code: withReact("declare const ref: { current: HTMLDivElement | null }\nuseEffect(() => { const el = ref.current; if (!el) return; const onScroll = () => undefined; el.addEventListener(\"scroll\", onScroll); return () => el.removeEventListener(\"scroll\", onScroll) }, [])") },
      { filename: FILE, code: withReact("declare const ref: { current: HTMLDivElement }\nuseEffect(() => { const onScroll = () => undefined; ref.current.addEventListener(\"scroll\", onScroll); return () => ref.current.removeEventListener(\"scroll\", onScroll) }, [])") },
      // a media query list
      { filename: FILE, code: withReact("useEffect(() => { const mql = window.matchMedia(\"(min-width: 600px)\"); const onChange = () => undefined; mql.addEventListener(\"change\", onChange); return () => mql.removeEventListener(\"change\", onChange) }, [])") },
      // one signal aborts every listener registered with it
      { filename: FILE, code: withReact("useEffect(() => { const controller = new AbortController(); window.addEventListener(\"resize\", () => undefined, { signal: controller.signal }); return () => controller.abort() }, [])") },
      // useSyncExternalStore subscribe: register, return the unregister
      { filename: HOOK, code: withReact("export const usePersisted = () => useSyncExternalStore((cb) => { window.addEventListener(\"storage\", cb); return () => window.removeEventListener(\"storage\", cb) }, () => 1)") },
      // outside an effect a listener is not this rule's business (a handler attaching once, a class, a script)
      { filename: FILE, code: "const attach = () => { window.addEventListener(\"x\", () => undefined) }" },
    ],
    invalid: [
      { filename: FILE, code: withReact("useEffect(() => { window.addEventListener(\"resize\", onResize) }, [])\ndeclare const onResize: () => void"), errors: unreleased },
      { filename: FILE, code: withReact("useEffect(() => { const h = () => undefined; window.addEventListener(\"resize\", h); return () => undefined }, [])"), errors: unreleased },
      // another event type, another listener, another target: none of them releases this registration
      { filename: FILE, code: withReact("useEffect(() => { const h = () => undefined; window.addEventListener(\"resize\", h); return () => window.removeEventListener(\"scroll\", h) }, [])"), errors: unreleased },
      { filename: FILE, code: withReact("useEffect(() => { const h = () => undefined; const g = () => undefined; window.addEventListener(\"resize\", h); return () => window.removeEventListener(\"resize\", g) }, [])"), errors: unreleased },
      { filename: FILE, code: withReact("useEffect(() => { const h = () => undefined; window.addEventListener(\"resize\", h); return () => document.removeEventListener(\"resize\", h) }, [])"), errors: unreleased },
      // an inline listener cannot be removed
      { filename: FILE, code: withReact("useEffect(() => { window.addEventListener(\"resize\", () => undefined); return () => window.removeEventListener(\"resize\", () => undefined) }, [])"), errors: unreleased },
      // a signal nobody aborts
      { filename: FILE, code: withReact("useEffect(() => { const controller = new AbortController(); window.addEventListener(\"resize\", () => undefined, { signal: controller.signal }) }, [])"), errors: unreleased },
      { filename: FILE, code: withReact("declare const ref: { current: HTMLDivElement }\nuseEffect(() => { const h = () => undefined; ref.current.addEventListener(\"scroll\", h) }, [])"), errors: unreleased },
      { filename: FILE, code: withReact("useEffect(() => { const mql = window.matchMedia(\"(min-width: 600px)\"); mql.addEventListener(\"change\", () => undefined) }, [])"), errors: unreleased },
      { filename: HOOK, code: withReact("export const usePersisted = () => useSyncExternalStore((cb) => { window.addEventListener(\"storage\", cb); return () => undefined }, () => 1)"), errors: unreleased },
    ],
  })
})

test("HYGIENE-1c: observers, sockets and subscriptions", () => {
  typed.run("effect-subscription-needs-cleanup", effectSubscriptionNeedsCleanup, {
    valid: [
      { filename: FILE, code: withReact("declare const el: HTMLElement\nuseEffect(() => { const ro = new ResizeObserver(() => undefined); ro.observe(el); return () => ro.disconnect() }, [])") },
      { filename: FILE, code: withReact("declare const el: HTMLElement\nuseEffect(() => { const io = new IntersectionObserver(() => undefined); io.observe(el); return () => { io.disconnect() } }, [])") },
      { filename: FILE, code: withReact("declare const el: HTMLElement\nuseEffect(() => { const mo = new MutationObserver(() => undefined); mo.observe(el, { childList: true }); return () => mo.disconnect() }, [])") },
      // an observer that observes nothing holds nothing
      { filename: FILE, code: withReact("useEffect(() => { const ro = new ResizeObserver(() => undefined); void ro }, [])") },
      { filename: FILE, code: withReact("useEffect(() => { const ws = new WebSocket(\"wss://x.test\"); return () => ws.close() }, [])") },
      { filename: FILE, code: withReact("useEffect(() => { const es = new EventSource(\"/events\"); return () => es.close() }, [])") },
      { filename: FILE, code: withReact("useEffect(() => { const bc = new BroadcastChannel(\"c\"); return () => { bc.close() } }, [])") },
      // SWR mutate called from a socket message handler is the sanctioned refresh path
      { filename: HOOK, code: withReact("import useSWR from \"swr\"\ndeclare const key: string\ndeclare const fetcher: () => Promise<number>\nexport const useLive = () => { const { mutate } = useSWR(key, fetcher); useEffect(() => { const ws = new WebSocket(\"wss://x.test\"); ws.onmessage = () => { void mutate() }; return () => ws.close() }, [mutate]) }") },
      // a subscription object released with the method its type names
      { filename: HOOK, code: withReact("declare const bus: { subscribe(cb: () => void): { unsubscribe(): void } }\nuseEffect(() => { const sub = bus.subscribe(() => undefined); return () => sub.unsubscribe() }, [])") },
      { filename: HOOK, code: withReact("declare const bus: { watch(cb: () => void): { off(): void } }\nuseEffect(() => { const w = bus.watch(() => undefined); return () => w.off() }, [])") },
      { filename: HOOK, code: withReact("declare function open(): { close(): void }\nuseEffect(() => { const c = open(); return () => c.close() }, [])") },
      // a call whose result merely has a `close` because it is a DOM node or a window is not a subscription
      { filename: HOOK, code: withReact("useEffect(() => { const dialog = document.querySelector<HTMLDialogElement>(\"dialog\"); const w = window.open(\"/x\"); void dialog; void w }, [])") },
      // a function-returning unsubscribe is not decided here (the checker cannot tell it from any callback)
      { filename: HOOK, code: withReact("declare const on: (cb: () => void) => () => void\nuseEffect(() => { const off = on(() => undefined); return () => off() }, [])") },
    ],
    invalid: [
      { filename: FILE, code: withReact("declare const el: HTMLElement\nuseEffect(() => { const ro = new ResizeObserver(() => undefined); ro.observe(el) }, [])"), errors: unreleased },
      { filename: FILE, code: withReact("declare const el: HTMLElement\nuseEffect(() => { const io = new IntersectionObserver(() => undefined); const other = new IntersectionObserver(() => undefined); io.observe(el); return () => other.disconnect() }, [])"), errors: unreleased },
      // a chained observe leaves nothing to disconnect
      { filename: FILE, code: withReact("declare const el: HTMLElement\nuseEffect(() => { new MutationObserver(() => undefined).observe(el, { childList: true }) }, [])"), errors: unreleased },
      { filename: FILE, code: withReact("declare const el: HTMLElement\nuseEffect(() => { const mo = new MutationObserver(() => undefined); mo.observe(el, { childList: true }); return () => mo.takeRecords() }, [])"), errors: unreleased },
      { filename: FILE, code: withReact("useEffect(() => { const ws = new WebSocket(\"wss://x.test\") }, [])"), errors: unreleased },
      { filename: FILE, code: withReact("useEffect(() => { const es = new EventSource(\"/events\"); return () => undefined }, [])"), errors: unreleased },
      { filename: FILE, code: withReact("useEffect(() => { const bc = new BroadcastChannel(\"c\"); const other = new BroadcastChannel(\"d\"); return () => other.close() }, [])"), errors: unreleased },
      { filename: FILE, code: withReact("useEffect(() => { new WebSocket(\"wss://x.test\") }, [])"), errors: unreleased },
      { filename: HOOK, code: withReact("declare const bus: { subscribe(cb: () => void): { unsubscribe(): void } }\nuseEffect(() => { const sub = bus.subscribe(() => undefined) }, [])"), errors: unreleased },
      { filename: HOOK, code: withReact("declare const bus: { subscribe(cb: () => void): { unsubscribe(): void } }\nuseEffect(() => { const a = bus.subscribe(() => undefined); const b = bus.subscribe(() => undefined); return () => b.unsubscribe() }, [])"), errors: unreleased },
      { filename: HOOK, code: withReact("declare const bus: { watch(cb: () => void): { off(): void } }\nuseEffect(() => { const w = bus.watch(() => undefined) }, [])"), errors: unreleased },
    ],
  })
})

test("HYGIENE-2: an effect does not start a load", () => {
  typed.run("no-data-fetch-in-effect", noDataFetchInEffect, {
    valid: [
      { filename: FILE, code: withReact("declare const title: string\nuseEffect(() => { document.title = title }, [title])") },
      { filename: FILE, code: withReact("declare const subscribe: (h: () => void) => () => void\ndeclare const handler: () => void\nuseEffect(() => { const off = subscribe(handler); return () => off() }, [])") },
      { filename: FILE, code: "import useSWR from \"swr\"\ndeclare const key: string\ndeclare const fetcher: () => Promise<number>\nconst { data } = useSWR(key, fetcher)" },
      // the cleanup is not the effect's own work
      { filename: FILE, code: withReact("declare function start(): void\ndeclare function stop(): Promise<void>\nuseEffect(() => { start(); return () => { void stop().then(() => undefined) } }, [])") },
      // a promise started inside a listener or a timer callback the effect registers is that callback's work
      { filename: FILE, code: withReact("declare function load(): Promise<number>\nuseEffect(() => { const onFocus = () => { void load() }; window.addEventListener(\"focus\", onFocus); return () => window.removeEventListener(\"focus\", onFocus) }, [])") },
      { filename: FILE, code: withReact("declare function load(): Promise<number>\nuseEffect(() => { const id = setTimeout(() => { void load() }, 100); return () => clearTimeout(id) }, [])") },
      // SWR mutate from a socket message handler
      { filename: HOOK, code: withReact("import useSWR from \"swr\"\ndeclare const key: string\ndeclare const fetcher: () => Promise<number>\nexport const useLive = () => { const { mutate } = useSWR(key, fetcher); useEffect(() => { const ws = new WebSocket(\"wss://x.test\"); ws.onmessage = () => { void mutate() }; return () => ws.close() }, [mutate]) }") },
      // a synchronous call, and a `void` of something that is not a promise
      { filename: FILE, code: withReact("declare function sync(): void\nuseEffect(() => { sync() }, [])") },
      { filename: FILE, code: withReact("declare function sync(): number\nuseEffect(() => { void sync() }, [])") },
      // a function declared in the effect and never called starts nothing
      { filename: FILE, code: withReact("declare function load(): Promise<number>\nuseEffect(() => { const later = () => load(); void later }, [])") },
      // platform promises that are not data loads
      { filename: FILE, code: withReact("declare const audio: HTMLAudioElement\nuseEffect(() => { void audio.play() }, [])") },
      { filename: FILE, code: withReact("declare const text: string\nuseEffect(() => { void navigator.clipboard.writeText(text) }, [text])") },
      { filename: FILE, code: withReact("useEffect(() => { document.fonts.ready.then(() => undefined) }, [])") },
      // a `useEffect` that is not React's
      { filename: FILE, code: "declare function useEffect(cb: () => void): void\ndeclare function load(): Promise<number>\nuseEffect(() => { void load() })" },
    ],
    invalid: [
      { filename: FILE, code: withReact("useEffect(() => { fetch('/x').then(() => undefined) }, [])"), errors: [{ messageId: "fetch" }] },
      { filename: FILE, code: withReact("declare function load(): Promise<number>\ndeclare const set: (n: number) => void\nuseEffect(() => { void (async () => { set(await load()) })() }, [])"), errors: [{ messageId: "fetch" }] },
      { filename: FILE, code: withReact("declare function load(): Promise<number>\ndeclare const set: (n: number) => void\nuseEffect(() => { load().then(set) }, [])"), errors: [{ messageId: "fetch" }] },
      { filename: FILE, code: withReact("declare const client: any\nuseEffect(() => { void client.read().then(() => undefined) }, [])"), errors: [{ messageId: "fetch" }] },
      { filename: FILE, code: "import * as React from \"react\"\ndeclare const client: any\nReact.useEffect(() => { void client.read().then(() => undefined) }, [])", errors: [{ messageId: "fetch" }] },
      // the indirect fetch: an async function called from the body, same file or anywhere else
      { filename: FILE, code: withReact("declare const id: string\nasync function load() { await fetch('/x/' + id) }\nuseEffect(() => { void load() }, [id])"), errors: [{ messageId: "fetch" }] },
      { filename: FILE, code: withReact("declare function load(): Promise<void>\nuseEffect(() => { load() }, [])"), errors: [{ messageId: "fetch" }] },
      { filename: FILE, code: withReact("useEffect(() => { const run = async () => { const r = await fetch('/x'); void r }; void run() }, [])"), errors: [{ messageId: "fetch" }] },
      { filename: FILE, code: withReact("declare const unknownLoad: any\nuseEffect(() => { void unknownLoad() }, [])"), errors: [{ messageId: "fetch" }] },
      { filename: FILE, code: withReact("useEffect(async () => { await fetch('/x') }, [])"), errors: [{ messageId: "fetch" }] },
      // an immediately-invoked function is the effect's own synchronous work
      { filename: FILE, code: withReact("useEffect(() => { (() => { void fetch('/x') })() }, [])"), errors: [{ messageId: "fetch" }] },
      // an SWR refresh called directly in the effect body is the same finding: freshness comes from the key
      { filename: HOOK, code: withReact("import useSWR from \"swr\"\ndeclare const key: string\ndeclare const fetcher: () => Promise<number>\nexport const useX = () => { const { mutate } = useSWR(key, fetcher); useEffect(() => { void mutate() }, [key]) }"), errors: [{ messageId: "fetch" }] },
      { filename: HOOK, code: withReact("import { useSWRConfig } from \"swr\"\ndeclare const key: string\nexport const useX = () => { const { mutate } = useSWRConfig(); useEffect(() => { mutate(key) }, [key]) }"), errors: [{ messageId: "fetch" }] },
      { filename: HOOK, code: withReact("import useSWR from \"swr\"\ndeclare const key: string\ndeclare const fetcher: () => Promise<number>\nexport const useX = () => { const { mutate } = useSWR(key, fetcher); const refresh = () => mutate(); useEffect(() => { refresh() }, [key]) }"), errors: [{ messageId: "fetch" }] },
    ],
  })
})

test("HYGIENE-3: a catch that does nothing hides the failure", () => {
  syntaxTester.run("no-empty-catch", noEmptyCatch, {
    valid: [
      { filename: PLAIN_FILE, code: "try { run() } catch (error) { return { kind: 'unavailable', cause: error } }" },
      { filename: PLAIN_FILE, code: "try { run() } catch (error) { throw error }" },
      { filename: PLAIN_FILE, code: "load().catch((error) => report(error))" },
      { filename: PLAIN_FILE, code: "try { run() } finally { done() }" },
    ],
    invalid: [
      { filename: PLAIN_FILE, code: "try { run() } catch {}", errors: [{ messageId: "empty" }] },
      { filename: PLAIN_FILE, code: "try { run() } catch (error) { /* ignore */ }", errors: [{ messageId: "empty" }] },
      { filename: PLAIN_FILE, code: "load().catch(() => {})", errors: [{ messageId: "promise" }] },
      { filename: PLAIN_FILE, code: "load().catch(() => undefined)", errors: [{ messageId: "promise" }] },
    ],
  })
})

test("HYGIENE-4: no console in product source", () => {
  syntaxTester.run("no-console", noConsole, {
    valid: [
      { filename: PLAIN_FILE, code: "const consoleWidth = 80" },
      { filename: PLAIN_FILE, code: "logger.error('x')" },
      { filename: at("apps/web/scripts/build.mjs"), code: "console.log('building')" },
      // a folder named src that no product slot owns is not product source
      { filename: at("tools/src/build.ts"), code: "console.log('building')" },
      { filename: at("packages/shop-ui/src/leaves/Chip/index.tsx"), code: "logger.info('x')" },
    ],
    invalid: [
      { filename: PLAIN_FILE, code: "console.log('x')", errors: [{ messageId: "console" }] },
      { filename: PLAIN_FILE, code: "console.error(error)", errors: [{ messageId: "console" }] },
      { filename: at("apps/web/src/modules/api/client.ts"), code: "console.warn('slow')", errors: [{ messageId: "console" }] },
      { filename: at("packages/shop-ui/src/leaves/Chip/index.tsx"), code: "console.log('x')", errors: [{ messageId: "console" }] },
    ],
  })
})
