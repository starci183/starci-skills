import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)))
const reportPath = path.join(base, "render-capture-r13.json")
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"))

const crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    return value >>> 0
})
const crc32 = (buffer) => {
    let value = 0xffffffff
    for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
    return (value ^ 0xffffffff) >>> 0
}
const annotateRaster = (source, label) => {
    if (source[0] === 0xff && source[1] === 0xd8) {
        const endAt = source.lastIndexOf(Buffer.from([0xff, 0xd9]))
        if (endAt < 2) throw new Error("JPEG end marker not found")
        const data = Buffer.from(`starci-cell:${label}`, "utf8")
        const comment = Buffer.alloc(4 + data.length)
        comment[0] = 0xff
        comment[1] = 0xfe
        comment.writeUInt16BE(data.length + 2, 2)
        data.copy(comment, 4)
        return Buffer.concat([source.subarray(0, endAt), comment, source.subarray(endAt)])
    }
    const markerAt = source.lastIndexOf(Buffer.from("IEND"))
    if (markerAt < 4) throw new Error("PNG IEND not found")
    const insertAt = markerAt - 4
    const type = Buffer.from("tEXt")
    const data = Buffer.from(`starci-cell\0${label}`, "utf8")
    const chunk = Buffer.alloc(12 + data.length)
    chunk.writeUInt32BE(data.length, 0)
    type.copy(chunk, 4)
    data.copy(chunk, 8)
    chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), 8 + data.length)
    return Buffer.concat([source.subarray(0, insertAt), chunk, source.subarray(insertAt)])
}

const result = report.output.result
const cells = result.blindReviewPacket.rasterCells
const used = new Set()
for (const cell of cells) {
    if (!used.has(cell.imageRef)) {
        used.add(cell.imageRef)
        continue
    }
    const annotated = annotateRaster(fs.readFileSync(path.join(base, cell.imageRef)), cell.cellRef)
    const digest = crypto.createHash("sha256").update(annotated).digest("hex")
    const imageRef = `sha256-${digest}.png`
    fs.writeFileSync(path.join(base, imageRef), annotated)
    cell.imageRef = imageRef
    used.add(imageRef)
}

result.handoffHostArtifact.imageRef = cells[0].imageRef
result.blindReviewPacket.lastScreenshotRef = cells[0].imageRef
for (let index = 0; index < result.renderMatrix.length; index += 1) {
    result.renderMatrix[index].imageRef = cells[index + 1].imageRef
}
let cellIndex = 1 + result.renderMatrix.length
for (let index = 0; index < result.adversarialProbeMatrix.length; index += 1) {
    const probe = result.adversarialProbeMatrix[index]
    const packetProbe = result.blindReviewPacket.probeCells[index]
    if (probe.outcome === "not-applicable") continue
    const imageRef = cells[cellIndex].imageRef
    probe.imageRef = imageRef
    packetProbe.imageRef = imageRef
    cellIndex += 1
}
result.blindReviewPacketFingerprint = `sha256:${crypto.createHash("sha256").update(JSON.stringify(result.blindReviewPacket)).digest("hex")}`
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n")
