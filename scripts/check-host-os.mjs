#!/usr/bin/env node

export function detectHostOs({ platform = process.platform, arch = process.arch } = {}) {
    if (platform === "win32") return {
        ok: true, platform, arch, family: "windows",
        credentialRunner: "powershell -NoProfile -ExecutionPolicy Bypass -File",
        supportedExtensions: [".mjs", ".ps1"],
    }
    if (platform === "darwin" || platform === "linux") return {
        ok: true, platform, arch, family: "posix",
        credentialRunner: "node",
        supportedExtensions: [".mjs", ".sh"],
    }
    return { ok: false, platform, arch, family: "unsupported", credentialRunner: null, supportedExtensions: [".mjs"] }
}

if (process.argv[1]?.endsWith("check-host-os.mjs")) {
    const result = detectHostOs()
    console.log(JSON.stringify(result))
    process.exitCode = result.ok ? 0 : 1
}
