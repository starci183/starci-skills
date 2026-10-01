import type { ExportMyDataResult } from "../../application/export-my-data.contracts"
import type { ExportMyDataType } from "./dto/export-my-data.type"

/** Maps the exported lines to the GraphQL types. */
export const toExportMyDataType = (result: ExportMyDataResult): Array<ExportMyDataType> =>
    result.lines.map((line) => ({ at: line.at, action: line.action, target: line.target }))
